{
  description = "Questionnaire development environment with full auth stack (Dex + oauth2-proxy + nginx)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      devShells = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};

          # Packages that require allowUnfree = true — loaded optionally
          unfreePackages = with pkgs; [
            gemini-cli
            claude-code
          ];

          corePackages = with pkgs; [
            nodejs_22
            dex-oidc
            nginx
            oauth2-proxy
            curl  # used by start-auth.sh health checks
          ];
        in {
          default = pkgs.mkShell {
            packages = corePackages
              # pkgs.config.allowUnfree is set in the user's nixpkgs config
              # (e.g. ~/.config/nixpkgs/config.nix or /etc/nixos/configuration.nix).
              ++ (if pkgs.config.allowUnfree or false then unfreePackages else []);

            shellHook = ''
              echo ""
              echo "┌─ Questionnaire dev environment ──────────────────────────────────────┐"
              echo "│                                                                        │"
              echo "│  npm install                  Install Node.js dependencies            │"
              echo "│  npm run build                Build the project                       │"
              echo "│  npm run web                  Start the questionnaire web server      │"
              echo "│                                                                        │"
              echo "│  ./dev/scripts/start-auth.sh  Start Dex + oauth2-proxy + nginx       │"
              echo "│  ./dev/scripts/stop-auth.sh   Stop the auth stack                    │"
              echo "│                                                                        │"
              echo "│  Once running, open: http://localhost:8080                            │"
              echo "│  Test users (password: 'password'):                                   │"
              echo "│    admin@example.com  (use ADMIN_GROUP env var for admin access)      │"
              echo "│    user@example.com                                                    │"
              echo "│                                                                        │"
              echo "│  See dev/README.md for full setup instructions.                       │"
              echo "│                                                                        │"
              echo "└────────────────────────────────────────────────────────────────────────┘"
              echo ""
            '';
          };
        });
    };
}
