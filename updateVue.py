

import os
import subprocess
import shutil
import sys
from pathlib import Path

def print_step(step_name):
    """打印步骤信息"""
    print(f"\n{'='*50}")
    print(f"🚀 {step_name}")
    print(f"{'='*50}")

def run_command(command, cwd=None):
    """运行命令并实时显示输出"""
    print(f"执行命令: {command}")
    
    # 在 Windows 上使用系统默认编码，其他系统使用 UTF-8
    import locale
    if sys.platform == 'win32':
        # Windows 系统通常使用 GBK 或 CP936
        encoding = locale.getpreferredencoding() or 'gbk'
    else:
        encoding = 'utf-8'
    
    process = subprocess.Popen(
        command,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True,
        cwd=cwd,
        encoding=encoding,
        errors='replace'  # 遇到无法解码的字符时用替换字符代替，而不是抛出异常
    )
    
    # 实时输出命令结果
    while True:
        output = process.stdout.readline()
        if output == '' and process.poll() is not None:
            break
        if output:
            print(output.strip())
    
    return_code = process.poll()
    if return_code != 0:
        raise subprocess.CalledProcessError(return_code, command)

def main():
    try:
        print("🎮 Vue 小游戏平台自动化构建部署脚本")
        print("=" * 60)
        
        # 获取当前工作目录
        current_dir = Path.cwd()
        vue_project_dir = current_dir / "webGamesVue"
        static_dist_dir = current_dir / "static" / "dist"
        vue_dist_dir = vue_project_dir / "dist"
        
        # 检查Vue项目目录是否存在
        if not vue_project_dir.exists():
            print("❌ 错误: webGamesVue 目录不存在!")
            sys.exit(1)
        
        # 检查package.json是否存在
        package_json = vue_project_dir / "package.json"
        if not package_json.exists():
            print("❌ 错误: webGamesVue/package.json 不存在!")
            sys.exit(1)
        
        # 步骤1: 构建Vue项目
        print_step("第1步: 构建Vue项目")
        print(f"Vue项目目录: {vue_project_dir}")
        
        # 运行npm run build
        run_command("npm run build", cwd=vue_project_dir)
        
        print("✅ Vue项目构建完成!")
        
        # 检查构建是否成功
        if not vue_dist_dir.exists():
            print("❌ 错误: 构建失败，dist目录不存在!")
            sys.exit(1)
        
        # 步骤2: 备份现有的static/dist目录（如果存在）
        print_step("第2步: 备份现有文件")
        
        if static_dist_dir.exists():
            backup_dir = current_dir / "static" / "dist_backup"
            if backup_dir.exists():
                shutil.rmtree(backup_dir)
            shutil.move(str(static_dist_dir), str(backup_dir))
            print(f"✅ 已备份现有文件到: {backup_dir}")
        else:
            print("ℹ️  static/dist 目录不存在，无需备份")
        
        # 步骤3: 复制新的dist目录
        print_step("第3步: 部署新文件")
        
        print(f"从: {vue_dist_dir}")
        print(f"到: {static_dist_dir}")
        
        # 复制整个dist目录
        shutil.copytree(str(vue_dist_dir), str(static_dist_dir))
        
        print("✅ 文件复制完成!")
        
        # 步骤4: 显示结果
        print_step("部署完成")
        print("🎉 Vue项目已成功构建并部署!")
        print(f"📁 新的静态文件位于: {static_dist_dir}")
        
        # 显示目录大小信息
        if static_dist_dir.exists():
            file_count = sum(1 for _ in static_dist_dir.rglob('*') if _.is_file())
            print(f"📊 部署文件数量: {file_count} 个文件")
        
        print("\n🚀 现在你可以重启应用来查看更新!")
        
    except subprocess.CalledProcessError as e:
        print(f"\n❌ 命令执行失败: {e}")
        print("💡 请检查:")
        print("   1. 确保已安装 Node.js 和 npm")
        print("   2. 确保在 webGamesVue 目录下运行过 'npm install'")
        print("   3. 检查 package.json 中是否有 'build' 脚本")
        sys.exit(1)
        
    except PermissionError as e:
        print(f"\n❌ 权限错误: {e}")
        print("💡 请确保有足够的权限读写文件夹")
        sys.exit(1)
        
    except Exception as e:
        print(f"\n❌ 未知错误: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
