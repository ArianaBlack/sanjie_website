/**
 * 页面动效 —— 滚动进场 + 数字滚动。
 *
 * 设计原则：
 *   1. **渐进增强**。默认状态下内容完全可见，只有 JS 确认可用时才启用「初始隐藏 → 滚动显现」。
 *      这样禁用 JS、脚本加载失败、或者爬虫抓取时，内容都在，不会出现空白页。
 *   2. **尊重 prefers-reduced-motion**。用户系统开了「减少动效」就全部跳过。
 *   3. **零依赖**。用原生 IntersectionObserver，不引入任何动画库。
 */

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 滚动进场 */
function initReveal() {
  const targets = document.querySelectorAll<HTMLElement>('.reveal');
  if (targets.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        // 显现一次之后就停止观察，避免来回滚动反复触发
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
  );

  // 已经在首屏内的元素由 CSS 的 .js-reveal 隐藏，这里立刻显现，避免闪烁
  for (const target of targets) observer.observe(target);
}

/** 数字滚动 */
function initCountUp() {
  const targets = document.querySelectorAll<HTMLElement>('[data-count-to]');
  if (targets.length === 0) return;

  const run = (el: HTMLElement) => {
    const to = Number(el.dataset.countTo);
    if (!Number.isFinite(to)) return;

    const suffix = el.dataset.countSuffix ?? '';
    const duration = 1400;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // easeOutExpo：开头快、结尾稳，比线性更有「落定」的感觉
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(to * eased);

      el.textContent = current.toLocaleString('zh-CN') + suffix;

      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = to.toLocaleString('zh-CN') + suffix;
    };

    requestAnimationFrame(tick);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        run(entry.target as HTMLElement);
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.4 }
  );

  for (const target of targets) observer.observe(target);
}

function init() {
  if (prefersReducedMotion()) return;

  // 告诉 CSS「JS 可用」，此时才启用初始隐藏状态
  document.documentElement.classList.add('js-reveal');

  initReveal();
  initCountUp();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
