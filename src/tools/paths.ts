import fs from 'node:fs';
import path from 'node:path';
import { cachedConfig } from '../config.js';

export interface ProjectRootContext {
  worktree?: string;
  directory?: string;
}

function isUsableRoot(candidate: string | undefined): boolean {
  if (typeof candidate !== 'string' || candidate === '') return false;
  const resolved = path.resolve(candidate);
  // Never allow "/" — a live session without a git worktree reports worktree
  // as "/" and writing there would violate SEC-001.
  if (resolved === '/') return false;
  try {
    return fs.statSync(resolved).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Resolve the project root for all decision tools.
 *
 * Prefers `ctx.worktree` when it is a non-empty string, is not "/" (after
 * resolution) and actually exists on disk; otherwise falls back to
 * `ctx.directory`. Throws when no usable root exists so no tool ever reads or
 * writes the register at "/" or at an empty path (SEC-001).
 */
export function resolveProjectRoot(ctx: ProjectRootContext): string {
  if (isUsableRoot(ctx.worktree)) {
    return path.resolve(ctx.worktree as string);
  }
  if (isUsableRoot(ctx.directory)) {
    return path.resolve(ctx.directory as string);
  }
  throw new Error(
    'Cannot resolve a project root: worktree and directory are missing, empty, ' +
      'missing on disk, or resolve to "/". Refusing to touch the decision register there.',
  );
}

export function withinWorktree(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function resolveRegisterPath(root: string): string {
  const resolvedRoot = path.resolve(root);
  if (resolvedRoot === '/') {
    throw new Error('Refusing to use "/" as the project root for the decision register');
  }
  const config = cachedConfig(resolvedRoot);
  const registerPath = path.resolve(resolvedRoot, config.registerPath);
  if (!withinWorktree(resolvedRoot, registerPath)) {
    throw new Error(`Configured register path escapes worktree: ${config.registerPath}`);
  }
  return registerPath;
}

export function resolveToolPath(root: string, filePath: string): string {
  const resolvedRoot = path.resolve(root);
  if (resolvedRoot === '/') {
    throw new Error('Refusing to use "/" as the project root for the decision register');
  }
  const resolved = path.resolve(resolvedRoot, filePath);
  if (!withinWorktree(resolvedRoot, resolved)) {
    throw new Error(`Path escapes worktree: ${filePath}`);
  }
  return resolved;
}
