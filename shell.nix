{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs_22
    pkgs.nodePackages.typescript
    pkgs.nodePackages.npm-check-updates
  ] ++ (if pkgs.config.allowUnfree or false then [
    pkgs.gemini-cli
    pkgs.claude-code
  ] else []);

  shellHook = ''
    echo "Questionnaire TUI development environment"
    echo "Node.js: $(node --version)"
    echo "npm: $(npm --version)"
    echo ""
    echo "Available commands:"
    echo "  npm install       - Install dependencies"
    echo "  npm run build     - Build the project"
    echo "  npm test          - Run tests"
    echo "  npm run validate  - Validate fixtures"
    echo "  npm start         - Run the application"
  '';
}
