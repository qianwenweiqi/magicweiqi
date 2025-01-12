import os

# Define directories to search for meaningful code
CODE_DIRS = [
    'frontend/src/api',
    'frontend/src/assets',
    'frontend/src/components',
    'frontend/src/config',
    'frontend/src/hooks',
    'frontend/src/pages',
    'frontend/src/services',
    'frontend/src/App.jsx',
    'frontend/src/App.css',
    'frontend/src/index.js',
    'frontend/src/index.css',
    'backend/routers',
    'backend/services'
]

def collect_code_files():
    """Collect all code files from specified directories"""
    code_files = []
    
    for code_dir in CODE_DIRS:
        if not os.path.exists(code_dir):
            continue
            
        for root, _, files in os.walk(code_dir):
            for file in files:
                if file.endswith(('.js', '.jsx', '.py')):
                    filepath = os.path.join(root, file)
                    code_files.append(filepath)
                    
    return code_files

def generate_combined_file(code_files):
    """Generate combined text file from collected code files"""
    total_chars = 0
    output_path = 'combined_code.txt'
    
    with open(output_path, 'w', encoding='utf-8') as outfile:
        for filepath in code_files:
            # Add file header
            header = f"File: {filepath}\n"
            outfile.write(header)
            total_chars += len(header)
            
            # Add file content
            with open(filepath, 'r', encoding='utf-8') as infile:
                content = infile.read()
                outfile.write(content)
                total_chars += len(content)
                
            # Add spacing between files
            outfile.write('\n\n')
            
    return output_path, total_chars

def main():
    code_files = collect_code_files()
    
    if not code_files:
        print("No code files found in specified directories")
        return
        
    output_path, total_chars = generate_combined_file(code_files)
    
    print(f"Combined file generated: {output_path}")
    print(f"Total character count: {total_chars}")
    
    # GPT O1 context window is ~128k tokens
    # Assuming 1 token ~= 4 chars, max ~512k chars
    if total_chars > 512000:
        print("Warning: Content exceeds GPT O1 context window")
    else:
        print("Content fits within GPT O1 context window")

if __name__ == '__main__':
    main()
