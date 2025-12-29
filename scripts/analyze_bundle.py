#!/usr/bin/env python3

"""
PHASE 4: Bundle Analysis Script
Analyzes dependencies and generates baseline metrics
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime

def main():
    # Get project root
    project_root = Path(__file__).parent.parent
    package_json_path = project_root / "package.json"

    if not package_json_path.exists():
        print(f"Error: package.json not found at {package_json_path}")
        sys.exit(1)

    # Read package.json
    with open(package_json_path, 'r') as f:
        package_json = json.load(f)

    # Collect all dependencies
    deps = {}
    deps.update(package_json.get('dependencies', {}))
    dev_deps = set(package_json.get('devDependencies', {}).keys())

    all_deps = []
    for name, version in sorted(deps.items()):
        all_deps.append({
            'name': name,
            'version': version,
            'isDev': name in dev_deps
        })

    print('📊 BUNDLE ANALYSIS REPORT')
    print('=' * 80)
    print('')

    prod_deps = [d for d in all_deps if not d['isDev']]
    dev_only = [d for d in all_deps if d['isDev']]

    print(f'Total Dependencies: {len(all_deps)}')
    print(f'Production Dependencies: {len(prod_deps)}')
    print(f'Dev Dependencies: {len(dev_only)}')
    print('')

    # Heavy dependencies with estimated sizes
    heavy_deps = [
        {'name': 'react-native-maps', 'weight': 250, 'category': 'Mapping'},
        {'name': 'react-native-reanimated', 'weight': 200, 'category': 'Animation'},
        {'name': 'react-native-paper', 'weight': 200, 'category': 'UI Library'},
        {'name': '@react-pdf/renderer', 'weight': 200, 'category': 'PDF'},
        {'name': 'pdf-lib', 'weight': 200, 'category': 'PDF'},
        {'name': '@react-navigation/native', 'weight': 150, 'category': 'Navigation'},
        {'name': 'react-native-gesture-handler', 'weight': 150, 'category': 'Gestures'},
        {'name': '@tanstack/react-query', 'weight': 80, 'category': 'State'},
        {'name': 'lucide-react-native', 'weight': 60, 'category': 'Icons'},
        {'name': 'lucide-react', 'weight': 60, 'category': 'Icons'}
    ]

    print('📦 HEAVY DEPENDENCIES (Estimated Size)')
    print('-' * 80)
    print('')

    total_estimated = 0
    dep_names = {d['name'] for d in all_deps}

    for idx, dep in enumerate(heavy_deps, 1):
        installed = '✅' if dep['name'] in dep_names else '⚠️'
        print(f"{idx}. {dep['name']:<40} {dep['weight']:>3}KB  {dep['category']:<15} {installed}")
        if dep['name'] in dep_names:
            total_estimated += dep['weight']

    print('')
    print(f'Estimated total heavy deps: {total_estimated}KB')
    print('')

    # List all dependencies
    print('📋 PRODUCTION DEPENDENCIES')
    print('-' * 80)
    for dep in prod_deps:
        print(f"{dep['name']:<45} {dep['version']:<20} [PROD]")

    # Analyze large files
    print('')
    print('📂 LARGE COMPONENT FILES ANALYSIS')
    print('-' * 80)
    print('')

    def find_large_files(directory, pattern=['*.tsx', '*.ts', '*.jsx', '*.js'], limit=20):
        """Find large files in a directory"""
        if not os.path.exists(directory):
            return []

        files = []
        try:
            for root, dirs, filenames in os.walk(directory):
                # Skip node_modules and other build directories
                dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'dist', 'build']]

                for filename in filenames:
                    if any(filename.endswith(p.replace('*', '')) for p in pattern):
                        filepath = os.path.join(root, filename)
                        try:
                            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                                lines = len(f.readlines())
                            size = os.path.getsize(filepath) / 1024  # KB
                            files.append({
                                'name': os.path.basename(filepath),
                                'path': filepath,
                                'lines': lines,
                                'size_kb': size
                            })
                        except:
                            pass
        except:
            pass

        return sorted(files, key=lambda x: x['lines'], reverse=True)[:limit]

    components = find_large_files(str(project_root / 'components'))
    if components:
        print('Components:')
        for f in components:
            print(f"  {f['name']:<45} Lines: {f['lines']:>5}  Size: {f['size_kb']:>8.2f}KB")

    app_files = find_large_files(str(project_root / 'app'))
    if app_files:
        print('')
        print('App routes:')
        for f in app_files:
            print(f"  {f['name']:<45} Lines: {f['lines']:>5}  Size: {f['size_kb']:>8.2f}KB")

    # Create baseline metrics
    baseline_metrics = {
        'timestamp': datetime.now().isoformat(),
        'phase': 4,
        'week': 1,
        'dependencies': {
            'total': len(all_deps),
            'production': len(prod_deps),
            'dev': len(dev_only),
            'heavyDependencies': heavy_deps
        },
        'estimatedBundleSize': {
            'heavyDependenciesTotal': f'{total_estimated}KB',
            'estimatedMinified': '~800-1000KB',
            'estimatedGzipped': '~250-350KB',
            'target': {
                'gzipped': '< 500KB',
                'minified': '< 1000KB'
            }
        },
        'status': 'ANALYSIS_IN_PROGRESS'
    }

    metrics_path = project_root / 'BASELINE_METRICS.json'
    with open(metrics_path, 'w') as f:
        json.dump(baseline_metrics, f, indent=2)

    print('')
    print('✅ Baseline metrics saved to BASELINE_METRICS.json')
    print('')
    print('=' * 80)
    print('Next steps:')
    print('1. Run: npm run build:web')
    print('2. Analyze bundle with webpack-bundle-analyzer')
    print('3. Run Lighthouse audit')
    print('4. Profile React component rendering')
    print('=' * 80)

if __name__ == '__main__':
    main()

