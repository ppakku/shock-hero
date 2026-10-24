import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
  // 에이전트 작업용 복사본(.claude/worktrees)은 테스트와 개발 서버 감시에서 뺀다
  test: { include: ['tests/**/*.test.js'] },
  server: { watch: { ignored: ['**/.claude/**'] } },
});
