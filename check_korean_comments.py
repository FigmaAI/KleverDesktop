import os
import re
from pathlib import Path

def is_binary_file(file_path):
    """Check if file is binary."""
    try:
        with open(file_path, 'tr') as check_file:
            check_file.read()
            return False
    except UnicodeDecodeError:
        return True

def has_korean_comments(file_path):
    """Check if file contains Korean comments."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # Korean character range: AC00-D7A3 (complete Korean)
            korean_pattern = re.compile('[\uAC00-\uD7A3]')
            if korean_pattern.search(content):
                return True
    except UnicodeDecodeError:
        return False
    return False

def check_directory():
    """Scan directory for files with Korean comments."""
    root_dir = Path('.')
    gitignore_path = root_dir / '.gitignore'
    
    # use gitignore file
    ignored_patterns = set()
    if gitignore_path.exists():
        with open(gitignore_path, 'r') as f:
            ignored_patterns = {line.strip() for line in f if line.strip() and not line.startswith('#')}

    def is_ignored(path):
        """Check if path matches any gitignore pattern."""
        rel_path = str(path.relative_to(root_dir))
        for pattern in ignored_patterns:
            if pattern.endswith('/'):
                if rel_path.startswith(pattern):
                    return True
            elif pattern.startswith('*'):
                if rel_path.endswith(pattern[1:]):
                    return True
            elif pattern in rel_path:
                return True
        return False

    print("Scanning for files with Korean comments...")
    print("-" * 50)

    found_files = []
    for path in root_dir.rglob('*'):
        if path.is_file() and not is_ignored(path):
            if not is_binary_file(path) and has_korean_comments(path):
                found_files.append(path)
                print(f"Found Korean comments in: {path}")

    print("-" * 50)
    print(f"Total files with Korean comments: {len(found_files)}")
    
    # save result to log file
    with open('korean_comments_log.txt', 'w', encoding='utf-8') as log:
        log.write("Files containing Korean comments:\n")
        log.write("-" * 50 + "\n")
        for file_path in found_files:
            log.write(f"{file_path}\n")
        log.write("-" * 50 + "\n")
        log.write(f"Total files: {len(found_files)}")

if __name__ == '__main__':
    check_directory() 