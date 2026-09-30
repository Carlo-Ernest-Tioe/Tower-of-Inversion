//=============================================================================
// FuzzyDifficultyEngine.js
// Tower of Inversion: Descent to Earth
// Adaptive Game Framework - Fuzzy Inference System (Mamdani) untuk
// Dynamic Difficulty Adjustment (DDA) berbasis Elemental Affinity + Performa Party
//
// PENTING: load plugin ini SETELAH ElementalAffinityCycle.js di Plugin Manager,
// karena plugin ini menumpuk (chain) alias di atas Game_Action.calcElementRate
// milik plugin itu.
//=============================================================================

/*:
 * @plugindesc [Tower of Inversion] Fuzzy Inference System (Mamdani) untuk Dynamic Difficulty Adjustment. v1.0
 * @author Carlo
 *
 * @param History Window Size
 * @desc Jumlah aksi elemental pemain terakhir yang dipakai untuk menghitung input Efektivitas Elemental.
 * @type number
 * @min 1
 * @default 5
 *
 * @param Action Exponent Low
 * @desc Exponent kurva probabilitas aksi musuh saat kesulitan RENDAH. 0 = peluang rata untuk semua aksi.
 * @default 0.0
 *
 * @param Action Exponent High
 * @desc Exponent kurva probabilitas aksi musuh saat kesulitan TINGGI (besar = condong ke rating tertinggi). Di kesulitan Sedang exponent otomatis ~1.0 = peluang proporsional dengan rating.
 * @default 2.0
 *
 * @param Targeting Bias Max
 * @desc Seberapa kuat musuh mengincar target ber-HP% terendah saat kesulitan TINGGI (0 = selalu acak, 1 = selalu incar HP terendah).
 * @default 0.8
 *
 * @param Show Fuzzy Gauge
 * @desc Tampilkan gauge kecil di battle screen yang menunjukkan tingkat kesulitan fuzzy saat ini.
 * @type boolean
 * @default true
 *
 * @param Debug Log
 * @desc Tampilkan detail perhitungan fuzzy (fuzzifikasi, rule strength, defuzzifikasi) di console.
 * @type boolean
 * @default false
 *
 * @help
 * =============================================================================
 * TOWER OF INVERSION - FUZZY DIFFICULTY ENGINE (Mamdani FIS)
 * =============================================================================
 * Implementasi Adaptive Game Framework: Fuzzy Inference System metode Mamdani
 * yang menyesuaikan PERILAKU TAKTIS musuh (pemilihan target & pemilihan skill)
 * berdasarkan konsistensi tindakan elemental pemain dan performa party saat
 * battle berjalan. TIDAK mengubah angka statistik dasar musuh (HP/ATK/DEF dst)
 * sesuai batasan desain di GDD.
 *
 * -----------------------------------------------------------------------
 * INPUT 1: Efektivitas Elemental (EE)
 * -----------------------------------------------------------------------
 * Rata-rata dari N aksi elemental pemain terakhir (N = "History Window Size").
 * Setiap aksi yang kena calcElementRate dari ElementalAffinityCycle dikonversi:
 *   advantage (150%)    -> nilai 1.0
 *   neutral/same (100%) -> nilai 0.5
 *   disadvantage (50%)  -> nilai 0.0
 * Nilai akhir EE = rata-rata N nilai terakhir (0-1). Default 0.5 kalau belum
 * ada histori (anggap netral/sedang di awal battle).
 *
 * -----------------------------------------------------------------------
 * INPUT 2: Performa Party (PP)
 * -----------------------------------------------------------------------
 * Rata-rata %HP seluruh anggota party yang masih hidup (0-1).
 *
 * -----------------------------------------------------------------------
 * FUZZIFIKASI
 * -----------------------------------------------------------------------
 * Kedua input dipetakan ke 3 himpunan fuzzy: Rendah, Sedang, Tinggi, dengan
 * fungsi keanggotaan trapesium (Rendah/Tinggi) dan segitiga (Sedang) simetris
 * di rentang [0,1] dengan titik tengah 0.5.
 *
 * -----------------------------------------------------------------------
 * RULE BASE (Mamdani, 3x3 = 9 rule, operator AND = MIN)
 * -----------------------------------------------------------------------
 *   EE\PP     Rendah   Sedang   Tinggi
 *   Rendah    Rendah   Rendah   Rendah
 *   Sedang    Rendah   Sedang   Tinggi
 *   Tinggi    Sedang   Tinggi   Tinggi
 *
 * EE dibuat dominan: EE Rendah SELALU menarik output ke Rendah apapun
 * kondisi HP party-nya (supaya pilihan elemen yang buruk langsung kerasa
 * efeknya, tidak perlu HP ikut turun dulu). PP berperan sebagai penentu di
 * kondisi EE Sedang, dan pendorong tambahan di kondisi EE Tinggi.
 *
 * -----------------------------------------------------------------------
 * DEFUZZIFIKASI
 * -----------------------------------------------------------------------
 * Agregasi MAX per kategori output, lalu weighted average (representative
 * value Rendah=0.2, Sedang=0.5, Tinggi=0.8) menghasilkan difficultyFactor
 * (0-1) yang dipakai untuk:
 *   1. Reweight rating aksi musuh (Game_Enemy.selectAllActions) - kesulitan
 *      tinggi -> musuh lebih condong pakai skill kuat; kesulitan rendah ->
 *      peluang lebih merata (termasuk aksi lemah).
 *   2. Reweight target selection musuh (Game_Action.decideRandomTarget) -
 *      kesulitan tinggi -> musuh lebih sering incar party member ber-HP%
 *      terendah; kesulitan rendah -> target tetap acak murni.
 *
 * Fuzzy difficulty dihitung ULANG setiap kali musuh akan membuat aksi baru
 * (per giliran musuh), bukan real-time per frame.
 *
 * -----------------------------------------------------------------------
 * CATATAN: PEMILIHAN AKSI MUSUH TIDAK PAKAI selectAllActions BAWAAN MV
 * -----------------------------------------------------------------------
 * Implementasi bawaan RPG Maker MV (Game_Enemy.prototype.selectAllActions)
 * otomatis membuang aksi yang rating-nya lebih dari 3 poin di bawah rating
 * tertinggi SEBELUM melakukan seleksi acak - filter ini bikin reweight
 * rating apapun jadi percuma kalau rentang rating dasar enemy sudah lebar
 * (misal 2/5/9, seperti enemy uji "Prisma Wyrm"). Plugin ini mengganti
 * total fungsi tersebut dengan weighted-random sendiri berbasis
 * rating^exponent, TANPA filter radius-3-poin itu, sehingga seluruh aksi
 * (termasuk yang rating-nya rendah) selalu punya peluang terpilih -
 * seberapa besar peluangnya diatur oleh exponent yang mengikuti
 * difficultyFactor (exponent rendah = peluang hampir merata, exponent
 * tinggi = sangat condong ke rating tertinggi).
 *
 * Guard (Block) dicatat sebagai netral secara terpisah (lewat hook
 * Game_Action.prototype.apply) karena Guard tidak pernah memanggil
 * calcElementRate sama sekali (damage type-nya "None").
 *
 * Expose global `window.FuzzyDifficultyEngine.getDifficultyFactor()` untuk
 * dipakai plugin lain (misal UI tambahan atau logging eksperimen).
 * =============================================================================
 */

(() => {
  'use strict';

  const PLUGIN_NAME = 'FuzzyDifficultyEngine';
  const params = PluginManager.parameters(PLUGIN_NAME);

  const HISTORY_WINDOW = Math.max(1, Number(params['History Window Size'] || 5));
  const ACTION_EXPONENT_LOW = Number(params['Action Exponent Low'] !== undefined ? params['Action Exponent Low'] : 0.0);
  const ACTION_EXPONENT_HIGH = Number(params['Action Exponent High'] || 2.0);
  const TARGETING_BIAS_MAX = Number(params['Targeting Bias Max'] || 0.8);
  const SHOW_GAUGE = params['Show Fuzzy Gauge'] === 'true';
  const DEBUG_LOG = params['Debug Log'] === 'true';

  //---------------------------------------------------------------------
  // Persisted state helper (disimpan di $gameSystem supaya ikut save file)
  //---------------------------------------------------------------------
  function ensureState() {
    if (!$gameSystem._fuzzyDDA) {
      $gameSystem._fuzzyDDA = {
        history: [],        // array nilai 0-1, elemental effectiveness per aksi
        difficulty: 0.5,    // difficultyFactor terakhir (0-1)
        lastEE: 0.5,
        lastPP: 0.5
      };
    }
    return $gameSystem._fuzzyDDA;
  }

  //---------------------------------------------------------------------
  // 1. Rekam histori efektivitas elemental setiap aksi PEMAIN
  //    (SEMUA aksi ke target, elemental atau tidak, supaya histori terus
  //    "encer" - Attack biasa dicatat sebagai netral 0.5 daripada dilewati,
  //    sehingga data lama tidak nyangkut selamanya kalau pemain berhenti
  //    pakai skill elemental).
  //---------------------------------------------------------------------
  const _Game_Action_calcElementRate = Game_Action.prototype.calcElementRate;
  Game_Action.prototype.calcElementRate = function(target) {
    const rate = _Game_Action_calcElementRate.call(this, target);
    try {
      if (this.subject() && this.subject().isActor() && target) {
        const hasElementTag = window.ElementalAffinityCycle &&
          !!window.ElementalAffinityCycle.getActionElement(this);

        let value = 0.5;
        if (hasElementTag && target._elementalCycleResult) {
          const resultType = target._elementalCycleResult;
          if (resultType === 'advantage') value = 1.0;
          else if (resultType === 'disadvantage') value = 0.0;
          else value = 0.5; // same/neutral
        }
        // Kalau skill tidak elemental (mis. Attack biasa), value tetap 0.5
        // (netral) - tetap dicatat supaya histori terus update/encer.

        const state = ensureState();
        state.history.push(value);
        if (state.history.length > HISTORY_WINDOW) {
          state.history.shift();
        }

        if (hasElementTag && target._elementalCycleResult) {
          const el = window.ElementalAffinityCycle.getActionElement(this);
          if (el) {
            if (!state.elementHistory) state.elementHistory = [];
            state.elementHistory.push(el);
            if (state.elementHistory.length > HISTORY_WINDOW) {
              state.elementHistory.shift();
            }
          }
        }
      }
    } catch (e) {
      if (DEBUG_LOG) console.log('[FuzzyDifficultyEngine] Gagal mencatat histori EE:', e);
    }
    return rate;
  };

  //---------------------------------------------------------------------
  // Elemen yang paling sering dipakai pemain baru-baru ini (buat dipakai
  // musuh shifting-element yang "smart" - lihat ShiftingElementEnemy.js)
  //---------------------------------------------------------------------
  function getMostUsedPlayerElement() {
    const state = ensureState();
    const hist = state.elementHistory || [];
    if (hist.length === 0) return null;
    const counts = {};
    hist.forEach(e => { counts[e] = (counts[e] || 0) + 1; });
    let best = null, bestCount = -1;
    for (const key in counts) {
      if (counts[key] > bestCount) { bestCount = counts[key]; best = key; }
    }
    return best;
  }

  //---------------------------------------------------------------------
  // 2. Hitung input EE & PP
  //---------------------------------------------------------------------
  function computeEE() {
    const state = ensureState();
    if (state.history.length === 0) return 0.5;
    const sum = state.history.reduce((a, b) => a + b, 0);
    return sum / state.history.length;
  }

  function computePP() {
    const members = $gameParty.aliveMembers();
    if (members.length === 0) return 0.5;
    const sum = members.reduce((a, m) => a + m.hpRate(), 0);
    return sum / members.length;
  }

  //---------------------------------------------------------------------
  // 3. Fuzzifikasi (trapesium Rendah/Tinggi, segitiga Sedang di [0,1])
  //---------------------------------------------------------------------
  function muRendah(x) {
    return Math.max(0, Math.min(1, (0.5 - x) / 0.5));
  }
  function muTinggi(x) {
    return Math.max(0, Math.min(1, (x - 0.5) / 0.5));
  }
  function muSedang(x) {
    return Math.max(0, 1 - Math.abs(x - 0.5) / 0.5);
  }

  //---------------------------------------------------------------------
  // 4. Rule base Mamdani (AND = MIN) + agregasi MAX per output + defuzzifikasi
  //    (weighted average dengan representative value Rendah=0.2/Sedang=0.5/Tinggi=0.8)
  //---------------------------------------------------------------------
  function evaluateFuzzy(ee, pp) {
    const eeR = muRendah(ee), eeS = muSedang(ee), eeT = muTinggi(ee);
    const ppR = muRendah(pp), ppS = muSedang(pp), ppT = muTinggi(pp);

    // Rule base 3x3 -> label output per kombinasi. EE dibuat lebih dominan
    // daripada PP: EE Rendah SELALU menarik ke Rendah apapun PP-nya (biar
    // sengaja pilih elemen salah beneran kerasa efeknya tanpa perlu HP
    // party ikut turun dulu). PP tetap berperan sebagai penentu di kondisi
    // EE Sedang, dan pendorong tambahan saat EE Tinggi.
    const rules = [
      { strength: Math.min(eeR, ppR), out: 'Rendah' },
      { strength: Math.min(eeR, ppS), out: 'Rendah' },
      { strength: Math.min(eeR, ppT), out: 'Rendah' },
      { strength: Math.min(eeS, ppR), out: 'Rendah' },
      { strength: Math.min(eeS, ppS), out: 'Sedang' },
      { strength: Math.min(eeS, ppT), out: 'Tinggi' },
      { strength: Math.min(eeT, ppR), out: 'Sedang' },
      { strength: Math.min(eeT, ppS), out: 'Tinggi' },
      { strength: Math.min(eeT, ppT), out: 'Tinggi' }
    ];

    let outRendah = 0, outSedang = 0, outTinggi = 0;
    for (const r of rules) {
      if (r.out === 'Rendah') outRendah = Math.max(outRendah, r.strength);
      else if (r.out === 'Sedang') outSedang = Math.max(outSedang, r.strength);
      else if (r.out === 'Tinggi') outTinggi = Math.max(outTinggi, r.strength);
    }

    const totalWeight = outRendah + outSedang + outTinggi;
    const difficultyFactor = totalWeight > 0
      ? (outRendah * 0.2 + outSedang * 0.5 + outTinggi * 0.8) / totalWeight
      : 0.5;

    if (DEBUG_LOG) {
      console.log('[FuzzyDifficultyEngine] EE=' + ee.toFixed(2) + ' (R:' + eeR.toFixed(2) + ' S:' + eeS.toFixed(2) + ' T:' + eeT.toFixed(2) + ')' +
        ' | PP=' + pp.toFixed(2) + ' (R:' + ppR.toFixed(2) + ' S:' + ppS.toFixed(2) + ' T:' + ppT.toFixed(2) + ')' +
        ' | outR=' + outRendah.toFixed(2) + ' outS=' + outSedang.toFixed(2) + ' outT=' + outTinggi.toFixed(2) +
        ' -> difficultyFactor=' + difficultyFactor.toFixed(3));
    }

    return difficultyFactor;
  }

  //---------------------------------------------------------------------
  // 5. Recompute difficulty - dipanggil sekali per giliran musuh
  //---------------------------------------------------------------------
  function recomputeDifficulty() {
    try {
      const ee = computeEE();
      const pp = computePP();
      const difficulty = evaluateFuzzy(ee, pp);
      const state = ensureState();
      state.lastEE = ee;
      state.lastPP = pp;
      state.difficulty = difficulty;
      return difficulty;
    } catch (e) {
      if (DEBUG_LOG) console.log('[FuzzyDifficultyEngine] Gagal recompute:', e);
      return 0.5;
    }
  }

  function getDifficultyFactor() {
    if (!$gameSystem) return 0.5;
    return ensureState().difficulty;
  }

  //---------------------------------------------------------------------
  // 6. Terapkan ke AI musuh: pilih aksi lewat kurva probabilitas sendiri
  //    (bukan ubah stat!). CATATAN PENTING: implementasi bawaan RPG Maker
  //    MV (Game_Enemy.prototype.selectAllActions) punya filter tersembunyi
  //    "cuma aksi dengan rating dalam radius 3 poin dari rating tertinggi
  //    yang boleh dipilih" - filter ini bikin reweight rating manapun jadi
  //    percuma kalau rentang rating dasar enemy sudah lebar (misal 2/5/9).
  //    Makanya di sini kita TIDAK memanggil fungsi asli MV sama sekali,
  //    diganti total dengan weighted-random sendiri berbasis rating^exponent,
  //    di mana exponent naik seiring difficultyFactor (exponent kecil =
  //    peluang hampir merata; exponent besar = sangat condong ke rating
  //    tertinggi).
  //---------------------------------------------------------------------
  const _Game_Enemy_makeActions = Game_Enemy.prototype.makeActions;
  Game_Enemy.prototype.makeActions = function() {
    recomputeDifficulty();
    _Game_Enemy_makeActions.call(this);
  };

  Game_Enemy.prototype.selectAllActions = function(actionList) {
    if (!actionList || actionList.length === 0) return;

    const difficulty = getDifficultyFactor();
    // exponent 0 (peluang rata) di difficulty=0, ~1.0 (peluang PROPORSIONAL
    // dengan rating - inilah arti "sesuai bobot") di difficulty=0.5, dan ~2.0
    // (condong kuat ke rating tertinggi) di difficulty=1.
    const exponent = ACTION_EXPONENT_LOW + difficulty * (ACTION_EXPONENT_HIGH - ACTION_EXPONENT_LOW);

    const weights = actionList.map(a => Math.pow(Math.max(a.rating, 1), exponent));
    const total = weights.reduce((s, w) => s + w, 0);

    if (DEBUG_LOG) {
      const summary = actionList.map((a, i) => {
        const sk = $dataSkills[a.skillId];
        return (sk ? sk.name : 'skill' + a.skillId) + '(rating=' + a.rating +
          ',bobot=' + weights[i].toFixed(2) + ',peluang=' + (weights[i] / total * 100).toFixed(1) + '%)';
      }).join(' | ');
      console.log('[FuzzyDifficultyEngine] AI selectAllActions difficulty=' + difficulty.toFixed(2) +
        ' exponent=' + exponent.toFixed(2) + ' -> ' + summary);
    }

    for (let i = 0; i < this.numActions(); i++) {
      let r = Math.random() * total;
      let chosen = actionList[actionList.length - 1];
      for (let j = 0; j < actionList.length; j++) {
        r -= weights[j];
        if (r <= 0) { chosen = actionList[j]; break; }
      }
      this.action(i).setEnemyAction(chosen);
    }
  };

  //---------------------------------------------------------------------
  // 6b. Catat aksi Guard (Block) sebagai netral di histori EE.
  //     Guard TIDAK PERNAH memanggil calcElementRate (karena damage type-nya
  //     "None"), jadi walau skill Guard sudah dikasih notetag <Element:Neutral>,
  //     itu tidak akan pernah kebaca lewat jalur calcElementRate. Perlu hook
  //     terpisah di titik action benar-benar dieksekusi.
  //---------------------------------------------------------------------
  const _Game_Action_apply = Game_Action.prototype.apply;
  Game_Action.prototype.apply = function(target) {
    _Game_Action_apply.call(this, target);
    try {
      const subject = this.subject();
      const item = this.item();
      if (subject && subject.isActor() && item &&
          $dataSystem && item.id === $dataSystem.guardSkillId &&
          DataManager.isSkill(item)) {
        const state = ensureState();
        state.history.push(0.5); // Guard dihitung netral
        if (state.history.length > HISTORY_WINDOW) {
          state.history.shift();
        }
        if (DEBUG_LOG) {
          console.log('[FuzzyDifficultyEngine] Guard tercatat sebagai netral (0.5) di histori EE.');
        }
      }
    } catch (e) {
      if (DEBUG_LOG) console.log('[FuzzyDifficultyEngine] Gagal mencatat Guard:', e);
    }
  };

  //---------------------------------------------------------------------
  // 7. Terapkan ke AI musuh: bias target selection ke HP% terendah
  //---------------------------------------------------------------------
  function weightedLowHpTarget(unit, difficulty) {
    const alive = unit.aliveMembers();
    if (alive.length === 0) return null;
    if (alive.length === 1) return alive[0];

    const bias = difficulty * TARGETING_BIAS_MAX; // 0 = full random, TARGETING_BIAS_MAX = full HP-terendah
    const weights = alive.map(m => {
      const inverseHpWeight = (1 - m.hpRate()) + 0.05;
      return (1 - bias) * 1 + bias * inverseHpWeight;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < alive.length; i++) {
      r -= weights[i];
      if (r <= 0) return alive[i];
    }
    return alive[alive.length - 1];
  }

  const _Game_Action_decideRandomTarget = Game_Action.prototype.decideRandomTarget;
  Game_Action.prototype.decideRandomTarget = function() {
    try {
      if (this.subject() && this.subject().isEnemy() && !this.isForFriend() && !this.isForDeadFriend()) {
        const target = weightedLowHpTarget(this.opponentsUnit(), getDifficultyFactor());
        if (target) {
          this._targetIndex = target.index();
          return;
        }
      }
    } catch (e) {
      if (DEBUG_LOG) console.log('[FuzzyDifficultyEngine] Targeting fallback ke default:', e);
    }
    _Game_Action_decideRandomTarget.call(this);
  };

  //---------------------------------------------------------------------
  // 8. Fuzzy Affinity Gauge - indikator kecil di battle screen
  //---------------------------------------------------------------------
  if (SHOW_GAUGE) {
    function Window_FuzzyGauge() {
      this.initialize.apply(this, arguments);
    }
    Window_FuzzyGauge.prototype = Object.create(Window_Base.prototype);
    Window_FuzzyGauge.prototype.constructor = Window_FuzzyGauge;

    Window_FuzzyGauge.prototype.initialize = function() {
      const width = 200;
      const height = this.fittingHeight ? this.fittingHeight(1) : 60;
      Window_Base.prototype.initialize.call(this, 0, 0, width, height);
      this.contents.fontSize = 16;
      this._lastDrawnValue = -1;
      this.refresh();
    };

    Window_FuzzyGauge.prototype.refresh = function() {
      this.contents.clear();
      const difficulty = getDifficultyFactor();
      const label = difficulty < 0.35 ? 'Rendah' : (difficulty < 0.65 ? 'Sedang' : 'Tinggi');
      const color = difficulty < 0.35 ? '#7be07b' : (difficulty < 0.65 ? '#ffe066' : '#ff6b6b');

      this.changeTextColor(this.systemColor ? this.systemColor() : '#ffffff');
      this.drawText('Adaptive Difficulty', 4, 0, this.contents.width - 8, 'left');

      const gaugeX = 4, gaugeY = 24, gaugeWidth = this.contents.width - 8, gaugeHeight = 12;
      this.contents.fillRect(gaugeX, gaugeY, gaugeWidth, gaugeHeight, '#333333');
      this.contents.fillRect(gaugeX, gaugeY, Math.round(gaugeWidth * difficulty), gaugeHeight, color);
      this.changeTextColor(color);
      this.drawText(label, gaugeX, gaugeY + gaugeHeight, gaugeWidth, 'right');
      this.resetTextColor();
    };

    Window_FuzzyGauge.prototype.update = function() {
      Window_Base.prototype.update.call(this);
      const difficulty = getDifficultyFactor();
      if (difficulty !== this._lastDrawnValue) {
        this._lastDrawnValue = difficulty;
        this.refresh();
      }
    };

    const _Scene_Battle_createAllWindows = Scene_Battle.prototype.createAllWindows;
    Scene_Battle.prototype.createAllWindows = function() {
      _Scene_Battle_createAllWindows.call(this);
      try {
        this._fuzzyGaugeWindow = new Window_FuzzyGauge();
        this._fuzzyGaugeWindow.x = Graphics.boxWidth - this._fuzzyGaugeWindow.width - 8;
        this._fuzzyGaugeWindow.y = 8;
        this.addWindow(this._fuzzyGaugeWindow);
      } catch (e) {
        if (DEBUG_LOG) console.log('[FuzzyDifficultyEngine] Gagal membuat gauge window:', e);
      }
    };
  }

  //---------------------------------------------------------------------
  // Expose ke global scope
  //---------------------------------------------------------------------
  window.FuzzyDifficultyEngine = {
    getDifficultyFactor,
    recomputeDifficulty,
    computeEE,
    computePP,
    getMostUsedPlayerElement
  };

})();
