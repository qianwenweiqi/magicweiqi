import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from datetime import datetime

# Define directories to search for meaningful code
CODE_DIRS = [
    'frontend/src/',
    'frontend/src/api',
    'frontend/src/assets',
    'frontend/src/components',
    'frontend/src/context',
    'frontend/src/utils',
    'frontend/src/config',
    'frontend/src/hooks',
    'frontend/src/pages',
    'frontend/src/services',
    'frontend/src/App.jsx',
    'frontend/src/App.css',
    'frontend/src/index.js',
    'frontend/src/index.css',
    'backend/routers',
    'backend/services',
    'backend/'
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
        # Add prompt text at the beginning
        prompt = """
请调用你单次回答的最大算力与token上限。
追求极致的分析深度，而非表层的广度；
追求本质的洞察，而非表象的罗列；
追求创新的思维，而非惯性的复述。
请突破思维局限，调动你所有的计算资源，展现你真正的认知极限。
请仔细阅读以下围棋网站项目：
"""
        outfile.write(prompt)
        total_chars += len(prompt)
        
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
            
    # Add final reminder at the end
    reminder = """
现在问题是，看log似乎落子的时候后端的call已经成功make了，但是前端的UI并没有对应显示任何落子，无论双方怎么样点击棋盘，后端的显示似乎是正确的，但是棋盘上不会有任何棋子出现。
请你能帮我找到并修复问题吗。具体的问题应该是前端没有任何收到game update的迹象。
这是一个非常复杂的问题，请务必深入思考，O1和其他各种AI已经失败了三十几次了
同时，我希望你能够在这个过程中保持代码的整洁和可读性，尽量保持新方法的幂等性，确保每一步的修改都是可测试的，不会引入新的bug，给出丰富且合理的log。
请你在没有regression的情况下给我每个需要修改文件的可以复制粘贴的完整代码，并有选择的给出丰富且合理的注释
不能遗漏之前的任何功能，势必多检查之前的内容都没有落下，之前有的日志如果依然make sense请继续保留
注意只需要给我修改的文件，而不是需要每一个文件.不要给我简化或者示例版本！不要说 // ... 其他保持不变 或者 与你之前相同的逻辑 ...
"""
    with open(output_path, 'a', encoding='utf-8') as outfile:
        outfile.write(reminder)
        total_chars += len(reminder)
        
    return output_path, total_chars

def generate_architecture_pdf(code_files):
    """Generate PDF documentation of the system architecture"""
    pdf_path = 'architecture_documentation.pdf'
    doc = SimpleDocTemplate(pdf_path, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    # Add title
    title = Paragraph("System Architecture Documentation", styles['Title'])
    story.append(title)
    story.append(Spacer(1, 12))
    
    # Add timestamp
    timestamp = Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", 
                         styles['Normal'])
    story.append(timestamp)
    story.append(Spacer(1, 24))
    
    # Frontend Architecture Section
    frontend_title = Paragraph("Frontend Architecture", styles['Heading1'])
    story.append(frontend_title)
    
    # Frontend components table
    frontend_components = [f for f in code_files if 'frontend/src/components' in f]
    if frontend_components:
        component_data = [['Component', 'Path']]
        component_data.extend([[os.path.basename(f), f] for f in frontend_components])
        
        t = Table(component_data)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.grey),
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('FONTSIZE', (0,0), (-1,0), 12),
            ('BOTTOMPADDING', (0,0), (-1,0), 12),
            ('BACKGROUND', (0,1), (-1,-1), colors.beige),
            ('GRID', (0,0), (-1,-1), 1, colors.black)
        ]))
        story.append(t)
        story.append(Spacer(1, 12))
    
    # Backend Architecture Section
    backend_title = Paragraph("Backend Architecture", styles['Heading1'])
    story.append(backend_title)
    
    # Backend services table
    backend_services = [f for f in code_files if 'backend/services' in f]
    if backend_services:
        service_data = [['Service', 'Path']]
        service_data.extend([[os.path.basename(f), f] for f in backend_services])
        
        t = Table(service_data)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.grey),
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('FONTSIZE', (0,0), (-1,0), 12),
            ('BOTTOMPADDING', (0,0), (-1,0), 12),
            ('BACKGROUND', (0,1), (-1,-1), colors.beige),
            ('GRID', (0,0), (-1,-1), 1, colors.black)
        ]))
        story.append(t)
        story.append(Spacer(1, 12))
    
    doc.build(story)
    return pdf_path

def main():
    code_files = collect_code_files()
    
    if not code_files:
        print("No code files found in specified directories")
        return
        
    # Generate architecture documentation PDF
    pdf_path = generate_architecture_pdf(code_files)
    print(f"Architecture documentation generated: {pdf_path}")
    
    # Generate combined code file for reference
    output_path, total_chars = generate_combined_file(code_files)
    print(f"Combined code file generated: {output_path}")
    print(f"Total character count: {total_chars}")
    
    # GPT O1 context window is ~128k tokens
    # Assuming 1 token ~= 4 chars, max ~512k chars
    if total_chars > 512000:
        print("Warning: Content exceeds GPT O1 context window")
    else:
        print("Content fits within GPT O1 context window")

if __name__ == '__main__':
    main()
