//=============================================================================
// ShiftingElementEnemy.js
// Tower of Inversion - Mekanik musuh dengan elemen yang berubah ADAPTIF
// mengikuti fuzzy difficulty & elemen favorit pemain (bukan cycle tetap yang
// bisa dihafal).
//
// PENTING: load plugin ini SETELAH ElementalAffinityCycle.js DAN SETELAH
// FuzzyDifficultyEngine.js (butuh keduanya).
//=============================================================================

/*:
 * @plugindesc [Tower of Inversion] Musuh dengan elemen adaptif mengikuti fuzzy difficulty (notetag <ShiftElement>). v2.0
 * @author Carlo
 *
 * @param Shift Cycle
 * @desc Daftar elemen yang bisa dipilih saat shifting (harus subset dari Cycle Order di ElementalAffinityCycle).
 * @default ["Fire","Wind","Earth","Water"]
 *
 * @param Smart Threshold High
 * @desc Ambang difficultyFactor (0-1) di atas mana musuh mulai nge-counter elemen favorit pemain.
 * @default 0.6
 *
 * @param Smart Threshold Low
 * @desc Ambang difficultyFactor (0-1) di bawah mana musuh mengalah (pilih elemen yang dikalahkan elemen favorit pemain).
 * @default 0.4
 *
 * @param Announce Shift
 * @desc Tampilkan pesan di battle log tiap kali elemen musuh berubah.
 * @type boolean
 * @default true
 *
 * @param Debug Log
 * @desc Tampilkan alasan pemilihan elemen (counter/mengalah/acak) di console.
 * @type boolean
 * @default false
 *
 * @help
 * =============================================================================
 * SHIFTING ELEMENT ENEMY (Adaptive, v2)
 * =============================================================================
 * Pasang notetag berikut di Note box Enemy:
 *
 *   <ShiftElement>
 *
 * BEDA dari versi sebelumnya (v1, cycle tetap Fire->Wind->Earth->Water yang
 * bisa dihafal pemain): versi ini memilih elemen baru SETIAP AKHIR GILIRAN
 * berdasarkan seberapa "pintar" pemain bermain (dibaca dari
 * FuzzyDifficultyEngine), bukan urutan tetap:
 *
 *   - difficultyFactor TINGGI (pemain konsisten milih elemen efektif +
 *     party masih sehat) -> musuh COUNTER: pindah ke elemen yang justru
 *     MENGALAHKAN elemen yang paling sering dipakai pemain baru-baru ini.
 *     Pemain dipaksa ganti strategi, bukan spam elemen yang sama.
 *
 *   - difficultyFactor RENDAH (pemain kesulitan) -> musuh MENGALAH: pindah
 *     ke elemen yang JUSTRU DIKALAHKAN oleh elemen favorit pemain, supaya
 *     comeback lebih mudah.
 *
 *   - difficultyFactor SEDANG, atau belum ada data elemen favorit pemain
 *     (awal battle) -> pilih elemen secara ACAK dari Shift Cycle.
 *
 * Karena keputusan bergantung pada histori & fuzzy state yang terus berubah,
 * pola shifting TIDAK bisa dihafal murni dari urutan giliran seperti versi
 * sebelumnya - pemain harus terus membaca badge elemen tiap giliran.
 *
 * Butuh window.ElementalAffinityCycle (buat siklus & override elemen) dan
 * window.FuzzyDifficultyEngine (buat difficultyFactor & elemen favorit
 * pemain) - pastikan urutan plugin: ElementalAffinityCycle -> 
 * FuzzyDifficultyEngine -> ShiftingElementEnemy.
 * =============================================================================
 */

(() => {
  'use strict';

  const PLUGIN_NAME = 'ShiftingElementEnemy';
  const params = PluginManager.parameters(PLUGIN_NAME);

  const SHIFT_CYCLE = JSON.parse(params['Shift Cycle'] || '["Fire","Wind","Earth","Water"]')
    .map(e => String(e).trim());
  const THRESHOLD_HIGH = Number(params['Smart Threshold High'] || 0.6);
  const THRESHOLD_LOW = Number(params['Smart Threshold Low'] || 0.4);
  const ANNOUNCE = params['Announce Shift'] === 'true';
  const DEBUG_LOG = params['Debug Log'] === 'true';

  function hasShiftTag(enemy) {
    return !!(enemy && enemy.note && enemy.note.indexOf('<ShiftElement>') >= 0);
  }

  function randomElement() {
    return SHIFT_CYCLE[Math.floor(Math.random() * SHIFT_CYCLE.length)];
  }

  // Elemen yang MENGALAHKAN elemen tertentu (prev di siklus)
  function counterOf(element) {
    const idx = SHIFT_CYCLE.findIndex(e => e.toLowerCase() === element.toLowerCase());
    if (idx === -1) return randomElement();
    return SHIFT_CYCLE[(idx - 1 + SHIFT_CYCLE.length) % SHIFT_CYCLE.length];
  }

  // Elemen yang DIKALAHKAN oleh elemen tertentu (next di siklus)
  function preyOf(element) {
    const idx = SHIFT_CYCLE.findIndex(e => e.toLowerCase() === element.toLowerCase());
    if (idx === -1) return randomElement();
    return SHIFT_CYCLE[(idx + 1) % SHIFT_CYCLE.length];
  }

  function decideNextElement() {
    const engine = window.FuzzyDifficultyEngine;
    const difficulty = (engine && engine.getDifficultyFactor) ? engine.getDifficultyFactor() : 0.5;
    const favoriteElement = (engine && engine.getMostUsedPlayerElement) ? engine.getMostUsedPlayerElement() : null;

    let mode, element;
    if (favoriteElement && difficulty >= THRESHOLD_HIGH) {
      mode = 'counter';
      element = counterOf(favoriteElement);
    } else if (favoriteElement && difficulty <= THRESHOLD_LOW) {
      mode = 'mengalah';
      element = preyOf(favoriteElement);
    } else {
      mode = 'acak';
      element = randomElement();
    }

    if (DEBUG_LOG) {
      console.log('[ShiftingElementEnemy] difficulty=' + difficulty.toFixed(2) +
        ' favoriteElement=' + favoriteElement + ' mode=' + mode + ' -> elemen baru=' + element);
    }
    return element;
  }

  //---------------------------------------------------------------------
  // Inisialisasi elemen awal saat enemy muncul di battle (acak, belum ada data)
  //---------------------------------------------------------------------
  const _Game_Enemy_setup = Game_Enemy.prototype.setup;
  Game_Enemy.prototype.setup = function(enemyId, x, y) {
    _Game_Enemy_setup.call(this, enemyId, x, y);
    try {
      if (hasShiftTag(this.enemy())) {
        this._elementOverride = randomElement();
      }
    } catch (e) { /* diamkan, fallback ke elemen notetag biasa */ }
  };

  //---------------------------------------------------------------------
  // Pilih elemen baru tiap akhir giliran, adaptif terhadap fuzzy difficulty
  //---------------------------------------------------------------------
  const _Game_Enemy_onTurnEnd = Game_Enemy.prototype.onTurnEnd;
  Game_Enemy.prototype.onTurnEnd = function() {
    _Game_Enemy_onTurnEnd.call(this);
    try {
      if (hasShiftTag(this.enemy()) && this.isAlive()) {
        const newElement = decideNextElement();
        this._elementOverride = newElement;

        if (ANNOUNCE && BattleManager._logWindow) {
          BattleManager._logWindow.push('addText',
            this.name() + '\u2019s aura shifts to ' + newElement + '!');
        }
      }
    } catch (e) {
      if (DEBUG_LOG) console.log('[ShiftingElementEnemy] Gagal shifting:', e);
    }
  };

})();
