import sys

def fix_file(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()

    new_lines = []
    skip = False
    in_conflict = False
    for line in lines:
        if line.startswith('<<<<<<< HEAD'):
            in_conflict = True
            continue
        if line.startswith('======='):
            skip = True
            continue
        if line.startswith('>>>>>>> main'):
            in_conflict = False
            skip = False
            continue
        if in_conflict and not skip:
            new_lines.append(line)
        if not in_conflict:
            new_lines.append(line)

    with open(filepath, 'w') as f:
        f.writelines(new_lines)

fix_file('src/__tests__/web/server.test.ts')
