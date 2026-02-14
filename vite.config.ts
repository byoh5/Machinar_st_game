import { defineConfig } from 'vite';

const repository = process.env.GITHUB_REPOSITORY ?? '';
const repositoryName = repository.split('/')[1] ?? '';
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
const isUserOrOrgPagesRepo = repositoryName.toLowerCase().endsWith('.github.io');

const githubBase = isUserOrOrgPagesRepo || !repositoryName ? '/' : `/${repositoryName}/`;
const base = process.env.BASE_PATH ?? (isGitHubActions ? githubBase : '/');

export default defineConfig({
  base,
});
