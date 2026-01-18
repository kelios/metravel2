#!/usr/bin/env node

/**
 * PHASE 4: Bundle Analysis Script
 * Analyzes dependencies and generates baseline metrics
 */

const fs = require('fs');
const path = require('path');

// Read package.json
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

// Collect all dependencies
const allDeps = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies
};

const depArray = Object.entries(allDeps).map(([name, version]) => ({
  name,
  version,
  isDev: !!packageJson.devDependencies[name]
}));



// Identify heavy dependencies (estimated)
const heavyDeps = [
  { name: 'react-leaflet', weight: 200, category: 'Mapping (OSM)' },
  { name: 'react-native-reanimated', weight: 200, category: 'Animation' },
  { name: 'react-native-paper', weight: 200, category: 'UI Library' },
  { name: '@react-pdf/renderer', weight: 200, category: 'PDF' },
  { name: 'pdf-lib', weight: 200, category: 'PDF' },
  { name: '@react-navigation/native', weight: 150, category: 'Navigation' },
  { name: 'react-native-gesture-handler', weight: 150, category: 'Gestures' },
  { name: '@tanstack/react-query', weight: 80, category: 'State' },
  { name: 'lucide-react-native', weight: 60, category: 'Icons' },
  { name: 'lucide-react', weight: 60, category: 'Icons' }
];


let totalEstimated = 0;
heavyDeps.forEach((dep, idx) => {
  const installed = allDeps[dep.name];
  const status = installed ? '✅' : '⚠️';
  console.log(`${idx + 1}. ${dep.name.padEnd(40)} ${dep.weight}KB  ${dep.category.padEnd(15)} ${status}`);
  if (installed) totalEstimated += dep.weight;
});


// List all dependencies
depArray.sort((a, b) => a.name.localeCompare(b.name)).forEach(dep => {
  const devLabel = dep.isDev ? '[DEV]' : '[PROD]';
  console.log(`${dep.name.padEnd(45)} ${dep.version.padEnd(20)} ${devLabel}`);
});

// Analyze component files

const componentDir = path.join(__dirname, '../components');
const appDir = path.join(__dirname, '../app');

function analyzeDir(dir, prefix = '') {
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.jsx') || f.endsWith('.js'))
    .map(f => {
      const filePath = path.join(dir, f);
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').length;
      return {
        name: f,
        path: filePath,
        lines,
        bytes: stats.size
      };
    })
    .sort((a, b) => b.lines - a.lines);

  files.slice(0, 20).forEach(f => {
    console.log(`${prefix}${f.name.padEnd(45)} Lines: ${f.lines.toString().padStart(5)}  Size: ${(f.bytes / 1024).toFixed(2)}KB`);
  });
}

analyzeDir(componentDir, '  ');

analyzeDir(appDir, '  ');

// Create baseline metrics JSON
const baselineMetrics = {
  timestamp: new Date().toISOString(),
  phase: 4,
  week: 1,
  dependencies: {
    total: depArray.length,
    production: depArray.filter(d => !d.isDev).length,
    dev: depArray.filter(d => d.isDev).length,
    heavyDependencies: heavyDeps
  },
  estimatedBundleSize: {
    heavyDependenciesTotal: `${totalEstimated}KB`,
    estimatedMinified: '~800-1000KB',
    estimatedGzipped: '~250-350KB',
    target: {
      gzipped: '< 500KB',
      minified: '< 1000KB'
    }
  },
  status: 'ANALYSIS_IN_PROGRESS'
};

const metricsPath = path.join(__dirname, '../BASELINE_METRICS.json');
fs.writeFileSync(metricsPath, JSON.stringify(baselineMetrics, null, 2));


