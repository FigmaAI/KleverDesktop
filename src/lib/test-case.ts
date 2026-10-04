import type { ApkSource, Project, Task } from '@/types/project'

const PACKAGE_NAME = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/

export function packageFromPlayStore(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    const name = parsed.searchParams.get('id') || ''
    return parsed.protocol === 'https:' && parsed.hostname === 'play.google.com' && parsed.pathname === '/store/apps/details' && PACKAGE_NAME.test(name) ? name : undefined
  } catch {
    return undefined
  }
}

export function validAppSource(source?: ApkSource): boolean {
  if (!source) return false
  if (source.type === 'installed_package') return PACKAGE_NAME.test(source.packageName?.trim() || '')
  if (source.type === 'apk_file') return !!source.path?.trim()
  return !!packageFromPlayStore(source.url || '')
}

export function appSourceLabel(source?: ApkSource): string {
  if (source?.packageName) return source.packageName
  if (source?.type === 'apk_file') return source.path?.split(/[/\\]/).pop() || ''
  return source?.url ? packageFromPlayStore(source.url) || source.url : ''
}

export function caseRuns(project: Project, caseId: string): Task[] {
  return project.tasks.filter((run) => run.testCaseId === caseId).reverse().sort((left, right) => (Date.parse(right.createdAt) || 0) - (Date.parse(left.createdAt) || 0))
}

export function runVersion(run: Task): string {
  const detected = run.app?.versionName || run.app?.versionCode
  return run.buildLabel && detected ? `${run.buildLabel} · ${detected}` : run.buildLabel || detected || ''
}
