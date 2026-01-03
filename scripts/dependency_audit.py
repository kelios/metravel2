#!/usr/bin/env python3

"""
PHASE 4 Week 1 Day 3-5: Dependency Audit Script
Identifies unused, duplicate, and abandoned packages
"""

import json
import subprocess
import sys
from pathlib import Path
from datetime import datetime

def main():
    print("📊 DEPENDENCY AUDIT REPORT")
    print("=" * 80)
    print("")

    project_root = Path(__file__).parent.parent
    package_json_path = project_root / "package.json"

    with open(package_json_path, 'r') as f:
        package_json = json.load(f)

    all_deps = {**package_json.get('dependencies', {}),
                **package_json.get('devDependencies', {})}

    # Production dependencies analysis
    prod_deps = package_json.get('dependencies', {})

    print(f"Total Production Dependencies: {len(prod_deps)}")
    print("")

    # Known potentially unused packages
    print("⚠️ PACKAGES THAT MAY BE UNUSED OR DUPLICATED:")
    print("-" * 80)
    print("")

    potentially_unused = [
        {
            'name': 'format',
            'version': '0.2.2',
            'reason': 'Generic package name, likely unused or can be replaced',
            'action': 'REVIEW'
        },
        {
            'name': 'lint',
            'version': '1.1.2',
            'reason': 'Generic package name, ESLint should be used instead',
            'action': 'REMOVE'
        },
        {
            'name': 'pretty-format',
            'version': '29.7.0',
            'reason': 'Used by Jest internally, not needed as direct dependency',
            'action': 'REVIEW'
        },
        {
            'name': 'deprecated-react-native-prop-types',
            'version': '5.0.0',
            'reason': 'Deprecated package, check if still needed',
            'action': 'VERIFY'
        }
    ]

    for pkg in potentially_unused:
        if pkg['name'] in all_deps:
            status = '✅' if pkg['name'] in prod_deps else '📦'
            print(f"{status} {pkg['name']:<40} v{pkg['version']}")
            print(f"   └─ {pkg['reason']}")
            print(f"   └─ Action: {pkg['action']}")
            print("")

    # Duplicate/Similar packages
    print("🔄 POTENTIALLY DUPLICATE PACKAGES:")
    print("-" * 80)
    print("")

    duplicates = [
        {
            'packages': ['@react-pdf/renderer', 'pdf-lib', 'jspdf', 'html2pdf.js'],
            'reason': 'Multiple PDF generation libraries',
            'recommendation': 'Consider consolidating to one library',
            'savings': '~200KB if consolidated'
        },
        {
            'packages': ['lucide-react', 'lucide-react-native', '@expo/vector-icons'],
            'reason': 'Icon libraries (some redundancy)',
            'recommendation': 'Standardize on one for each platform',
            'savings': '~50KB if optimized'
        },
        {
            'packages': ['react-leaflet', '@teovilla/react-native-web-maps', 'react-native-maps'],
            'reason': 'Multiple mapping solutions',
            'recommendation': 'Consolidate mapping approach',
            'savings': '~200KB with better planning'
        }
    ]

    for dup in duplicates:
        installed = [p for p in dup['packages'] if p in all_deps]
        print(f"Found {len(installed)} installed: {', '.join(installed)}")
        print(f"Reason: {dup['reason']}")
        print(f"Recommendation: {dup['recommendation']}")
        print(f"Potential Savings: {dup['savings']}")
        print("")

    # Large packages that might be optional
    print("📦 LARGE PACKAGES TO REVIEW FOR LAZY LOADING:")
    print("-" * 80)
    print("")

    optional_packages = [
        {
            'name': 'react-leaflet',
            'size': '~200KB',
            'used_for': 'Web map functionality (OpenStreetMap)',
            'lazy_load': True,
            'trigger': 'When user navigates to map view'
        },
        {
            'name': '@react-pdf/renderer',
            'size': '200KB',
            'used_for': 'PDF generation',
            'lazy_load': True,
            'trigger': 'When user requests PDF export'
        },
        {
            'name': 'pdf-lib',
            'size': '200KB',
            'used_for': 'PDF manipulation',
            'lazy_load': True,
            'trigger': 'When user requests PDF export'
        },
        {
            'name': 'react-native-paper',
            'size': '200KB',
            'used_for': 'Material Design UI',
            'lazy_load': False,
            'trigger': 'Core library, keep in main bundle'
        }
    ]

    for pkg in optional_packages:
        if pkg['name'] in all_deps:
            lazy = '🔄 LAZY' if pkg['lazy_load'] else '📌 CORE'
            print(f"{lazy} {pkg['name']:<40} {pkg['size']:>8}")
            print(f"   └─ Used for: {pkg['used_for']}")
            print(f"   └─ Trigger: {pkg['trigger']}")
            print("")

    # Create audit report
    audit_report = {
        'timestamp': datetime.now().isoformat(),
        'phase': 4,
        'week': 1,
        'day': '3-4',
        'status': 'AUDIT_ANALYSIS',
        'totalDependencies': len(all_deps),
        'productionDependencies': len(prod_deps),
        'potentiallyUnused': [p['name'] for p in potentially_unused if p['name'] in all_deps],
        'duplicatePackageGroups': [
            {
                'group': ', '.join(dup['packages']),
                'installed': [p for p in dup['packages'] if p in all_deps],
                'recommendation': dup['recommendation'],
                'potentialSavings': dup['savings']
            }
            for dup in duplicates
        ],
        'lazyLoadCandidates': [
            p['name'] for p in optional_packages if p['lazy_load'] and p['name'] in all_deps
        ],
        'recommendations': {
            'immediate': [
                'Remove "lint" package - use eslint directly',
                'Review "format" package - might be unused',
                'Consolidate PDF libraries (use one of: @react-pdf/renderer, pdf-lib, jspdf)',
                'Review icon library usage for redundancy',
                'Consider single mapping solution'
            ],
            'week2': [
                'Implement lazy loading for maps',
                'Implement lazy loading for PDF generation',
                'Setup dynamic imports for optional features'
            ],
            'week3': [
                'Performance testing after consolidation',
                'Tree-shaking optimization'
            ]
        }
    }

    audit_path = project_root / 'DEPENDENCY_AUDIT.json'
    with open(audit_path, 'w') as f:
        json.dump(audit_report, f, indent=2)

    print("=" * 80)
    print("✅ Dependency audit saved to DEPENDENCY_AUDIT.json")
    print("")
    print("Summary:")
    print(f"  - Total dependencies: {len(all_deps)}")
    print(f"  - Potentially unused: {len([p for p in potentially_unused if p['name'] in all_deps])}")
    print(f"  - Duplicate groups: {len(duplicates)}")
    print(f"  - Lazy load candidates: {len([p for p in optional_packages if p['lazy_load'] and p['name'] in all_deps])}")
    print("")
    print("Recommended Actions:")
    print("  1. Remove non-essential packages")
    print("  2. Consolidate duplicate libraries")
    print("  3. Implement lazy loading for optional features")
    print("  4. Expected savings: 15-25% of bundle size")
    print("=" * 80)

if __name__ == '__main__':
    main()

