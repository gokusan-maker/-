/* =========================================================================
 * 歴史年表
 * 年代ならべかえ・年号4択と同じできごとを、時代ごとの年表で見る。
 * 「年号をかくす」にすると、年号を思い出す練習ができる。
 * ========================================================================= */
(function () {
  'use strict';

  // 時代の区切り（年表の見出し用。始まりの年は教科書で一般的なもの）
  const PERIODS = [
    { name: '弥生・古墳時代', to: 592, color: '#b9a27a' },
    { name: '飛鳥時代', to: 709, color: '#9bb37a' },
    { name: '奈良時代', to: 793, color: '#7ab39b' },
    { name: '平安時代', to: 1184, color: '#c99ac9' },
    { name: '鎌倉時代', to: 1332, color: '#7a9bc9' },
    { name: '室町時代', to: 1572, color: '#c9a27a' },
    { name: '安土桃山時代', to: 1602, color: '#e0b04a' },
    { name: '江戸時代', to: 1867, color: '#d9622b' },
    { name: '明治時代', to: 1911, color: '#5b8fd5' },
    { name: '大正時代', to: 1925, color: '#8e7ad5' },
    { name: '昭和時代', to: 1988, color: '#d55b7a' },
    { name: '平成時代以降', to: 9999, color: '#4aa58a' }
  ];
  const periodOf = y => PERIODS.find(p => y <= p.to);

  window.SHAKAI_EXT = (window.SHAKAI_EXT || []).concat(App => {
    const { view, $, $$, esc } = App;
    const { EVENTS } = window.SHAKAI;

    function open() {
      App.onKey(null); App.stopTimer();
      const st = App.extState('timeline');
      const hide = !!st.hide;
      const events = EVENTS.slice().sort((a, b) => a.y - b.y);
      let html = '', cur = null;
      events.forEach((ev, k) => {
        const p = periodOf(ev.y);
        if (p !== cur) {
          if (cur) html += '</div>';
          html += `<div class="tl-period" style="--pc:${p.color}"><div class="tl-pname">${p.name}</div>`;
          cur = p;
        }
        html += `<button class="tl-row ${hide ? 'hidden-year' : ''}" data-k="${k}">
          <span class="tl-year">${ev.y}<small>年</small></span>
          <span class="tl-text">${esc(ev.t)}${ev.goro ? `<span class="tl-goro">💡 ${esc(ev.goro)}</span>` : ''}</span>
        </button>`;
      });
      html += '</div>';

      view.innerHTML = `
        <h2 style="margin-top:4px">📜 歴史年表</h2>
        <p class="muted">できごと${EVENTS.length}件。💡はゴロ合わせ（年号の覚え方）です。</p>
        <label class="card setting"><span><b>年号をかくす</b><br><span class="muted">年号を思い出してから、タップして確かめよう</span></span>
          <input type="checkbox" class="toggle" id="tl-hide" ${hide ? 'checked' : ''}></label>
        <div class="timeline">${html}</div>
        <div class="row" style="margin-top:16px">
          <button class="btn" id="tl-quiz">年号4択で確かめる</button>
          <button class="btn sub" id="home">ホームへ</button>
        </div>`;
      $('#tl-hide').onchange = e => { st.hide = e.target.checked; App.save(); open(); };
      $$('.tl-row').forEach(b => b.onclick = () => b.classList.toggle('peek'));
      $('#tl-quiz').onclick = () => App.startChrono && App.startChrono('nengo');
      $('#home').onclick = App.goHome;
      window.scrollTo(0, 0);
    }

    App.registerMode({ id: 'timeline', section: 'tool', icon: '📜', name: '歴史年表', desc: '時代ごとのできごととゴロ合わせ', start: open });
  });

  window.SHAKAI_PERIODS = PERIODS;
})();
