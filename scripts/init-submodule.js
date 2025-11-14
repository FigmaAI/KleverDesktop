#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */

const { execSync } = require('child_process');
const fs = require('fs');

const SUBMODULE_PATH = 'appagent';
const SUBMODULE_URL = 'https://github.com/FigmaAI/appagent.git';
const SUBMODULE_BRANCH = 'main';

function exec(command, options = {}) {
  try {
    return execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
      ...options
    });
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

function isGitRepo() {
  try {
    exec('git rev-parse --git-dir', { silent: true });
    return true;
  } catch {
    return false;
  }
}

function isSubmoduleEmpty(submodulePath) {
  if (!fs.existsSync(submodulePath)) {
    return true;
  }
  const files = fs.readdirSync(submodulePath);
  // .git만 있거나 비어있으면 empty로 간주
  return files.length === 0 || (files.length === 1 && files[0] === '.git');
}

function hasSubmoduleRegistered(submodulePath) {
  try {
    const output = exec('git config --file .gitmodules --get-regexp path', { 
      silent: true,
      ignoreError: true 
    });
    if (output && output.includes(submodulePath)) {
      return true;
    }
  } catch {
    // Ignore
  }
  return false;
}

console.log('🔧 Initializing submodules...\n');

// Step 1: Git 저장소 초기화
if (!isGitRepo()) {
  console.log('📦 Initializing git repository...');
  exec('git init');
  console.log('✅ Git repository initialized\n');
}

// Step 2: .gitmodules 파일 등록
if (fs.existsSync('.gitmodules')) {
  console.log('📝 Adding .gitmodules to git...');
  exec('git add .gitmodules', { ignoreError: true });
  console.log('✅ .gitmodules added\n');
}

// Step 3: appagent 상태 확인
const needsClone = isSubmoduleEmpty(SUBMODULE_PATH);

if (needsClone) {
  console.log('🗑️  Cleaning up empty or invalid appagent directory...');
  
  // 서브모듈 등록 해제 시도
  if (hasSubmoduleRegistered(SUBMODULE_PATH)) {
    exec(`git submodule deinit -f ${SUBMODULE_PATH}`, { ignoreError: true });
    exec(`git rm -rf ${SUBMODULE_PATH}`, { ignoreError: true });
    exec(`rm -rf .git/modules/${SUBMODULE_PATH}`, { ignoreError: true });
  }
  
  // 디렉토리 제거
  if (fs.existsSync(SUBMODULE_PATH)) {
    fs.rmSync(SUBMODULE_PATH, { recursive: true, force: true });
  }
  
  console.log('✅ Cleanup completed\n');
  
  // Step 4: 서브모듈 추가
  console.log(`📥 Cloning ${SUBMODULE_URL}...`);
  exec(`git submodule add -b ${SUBMODULE_BRANCH} ${SUBMODULE_URL} ${SUBMODULE_PATH}`, { 
    ignoreError: true 
  });
  console.log('✅ Submodule added\n');
}

// Step 5: 서브모듈 업데이트
console.log('🔄 Updating submodules...');
exec('git submodule update --init --recursive');
console.log('✅ Submodules updated\n');

// Step 6: 확인
if (fs.existsSync(SUBMODULE_PATH)) {
  const files = fs.readdirSync(SUBMODULE_PATH);
  if (files.length > 1) {
    console.log('✅ Submodule initialized successfully!');
    console.log(`📂 ${SUBMODULE_PATH}/ contains ${files.length} files/directories\n`);
  } else {
    console.log('⚠️  Warning: Submodule directory exists but may be empty');
    console.log('   Try running: git clone ' + SUBMODULE_URL + ' ' + SUBMODULE_PATH + '\n');
  }
} else {
  console.log('⚠️  Warning: Submodule directory was not created');
  console.log('   Try running: git clone ' + SUBMODULE_URL + ' ' + SUBMODULE_PATH + '\n');
}

