from pathlib import Path
import re

IP_REGEX = re.compile(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b')

# 日志目录，可在其中查找所有 .log 文件
LOG_DIR = Path("logs")

# 文件模式（目前匹配所有 .log 文件）
LOG_GLOB_PATTERN = "*.log"

def get_unique_ips(log_file: Path) -> set:
    """返回日志文件中不同 IP 地址的集合"""
    uniq_ips = set()
    with log_file.open(encoding="utf-8") as f:
        for line in f:
            m = IP_REGEX.search(line)
            if m:
                uniq_ips.add(m.group())
    return uniq_ips

def count_unique_ips(log_file: Path) -> int:
    """返回日志文件中不同 IP 地址的数量"""
    return len(get_unique_ips(log_file))

if __name__ == "__main__":
    # 检测 logs 目录下的所有 .log 文件
    if not LOG_DIR.exists():
        print(f"Log directory not found: {LOG_DIR}")
        exit(1)

    log_files = list(LOG_DIR.glob(LOG_GLOB_PATTERN))

    if not log_files:
        print(f"No .log files found in {LOG_DIR}")
        exit(0)

    # 统计跨所有日志文件的唯一 IP
    all_unique_ips: set[str] = set()

    for log_file in log_files:
        ips_in_file = get_unique_ips(log_file)
        all_unique_ips.update(ips_in_file)
        print(f"Unique IPs in {log_file}: {len(ips_in_file)}")

    print("\nTotal unique IPs across all log files:", len(all_unique_ips))
    print("List of all unique IPs:")
    for ip in sorted(all_unique_ips):
        print(ip) 