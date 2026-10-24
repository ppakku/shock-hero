import { defineConfig } from 'vite';

// 에이전트 작업용 복사본(.claude/worktrees) 안의 파일은 원본 개발 서버가 감시하지 않는다.
// 복사본 안에서 띄운 개발 서버는 자기 파일을 정상적으로 감시해야 하므로, 원본에서 띄웠을 때만 뺀다.
const inWorktree = process.cwd().includes('/.claude/');

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
  test: { include: ['tests/**/*.test.js'] },
  server: { watch: { ignored: inWorktree ? [] : ['**/.claude/**'] } },
});
