//=============================================================================
// ElementalAffinityCycle.js
// Tower of Inversion: Descent to Earth
// Sistem Elemental Affinity berbasis Empedoclean Four Elements Model
// Siklus kelemahan searah jarum jam, TANPA hubungan diagonal (netral)
//=============================================================================

/*:
 * @plugindesc [Tower of Inversion] Sistem Elemental Affinity siklikal (Api>Udara>Tanah>Air>Api), tanpa hubungan diagonal. v1.0
 * @author Carlo
 *
 * @param Cycle Order
 * @desc Urutan elemen dalam siklus searah jarum jam (elemen pertama mengalahkan elemen kedua, dst, melingkar).
 * @default ["Fire","Wind","Earth","Water"]
 *
 * @param Advantage Rate
 * @desc Multiplier damage saat elemen skill UNGGUL atas elemen target (%).
 * @default 150
 *
 * @param Disadvantage Rate
 * @desc Multiplier damage saat elemen skill KALAH atas elemen target (%).
 * @default 50
 *
 * @param Neutral Diagonal Rate
 * @desc Multiplier damage saat elemen skill & target berseberangan (diagonal, tidak berinteraksi) (%).
 * @default 100
 *
 * @param Same Element Rate
 * @desc Multiplier damage saat elemen skill sama persis dengan elemen target (%).
 * @default 100
 *
 * @param Show Popup
 * @desc Tampilkan teks "WEAK POINT" / "RESIST" di atas damage popup saat battle.
 * @type boolean
 * @default true
 *
 * @param Weak Popup Text
 * @desc Teks yang muncul saat menyerang elemen lemah musuh.
 * @default WEAK POINT!
 *
 * @param Resist Popup Text
 * @desc Teks yang muncul saat menyerang elemen yang unggul atas skill kita.
 * @default RESIST
 *
 * @param Show Party Affinity Badge
 * @desc Tampilkan badge kotak warna elemen di window status party saat battle.
 * @type boolean
 * @default true
 *
 * @param Show Enemy Affinity Badge
 * @desc Tampilkan badge kotak warna elemen di atas sprite musuh saat battle.
 * @type boolean
 * @default true
 *
 * @param Element Colors
 * @desc Warna hex per elemen untuk badge UI (JSON, key harus cocok dengan Cycle Order + "Neutral").
 * @default {"Fire":"#ff6b4a","Wind":"#7be0c9","Earth":"#c98a4b","Water":"#4a9bff","Neutral":"#aaaaaa"}
 *
 * @param Debug Log
 * @desc Tampilkan info elemen/rate tiap serangan di console (F8 di Playtest) untuk membantu troubleshooting.
 * @type boolean
 * @default false
 *
 * @help
 * =============================================================================
 * TOWER OF INVERSION - ELEMENTAL AFFINITY CYCLE
 * =============================================================================
 * Plugin ini mengimplementasikan sistem 4 elemen klasik (Api, Udara, Tanah,
 * Air) dengan siklus kelemahan SEARAH JARUM JAM dan TIDAK ADA hubungan
 * diagonal (elemen yang berseberangan bersifat netral terhadap satu sama
 * lain), sesuai GDD bab 2.2.
 *
 * Siklus default (searah jarum jam, "mengalahkan"):
 *   Api > Udara > Tanah > Air > Api (kembali ke awal)
 *
 * Artinya:
 *   - Skill Api melawan target Udara  => ADVANTAGE (150%)
 *   - Skill Udara melawan target Tanah => ADVANTAGE (150%)
 *   - Skill Tanah melawan target Air   => ADVANTAGE (150%)
 *   - Skill Air melawan target Api     => ADVANTAGE (150%)
 *   - Kebalikannya (skill Udara vs target Api, dst) => DISADVANTAGE (50%)
 *   - Api vs Tanah, Udara vs Air (diagonal)          => NETRAL (100%)
 *   - Elemen sama vs elemen sama                     => rate "Same Element"
 *
 * -----------------------------------------------------------------------
 * NOTETAG - Menentukan afinitas elemen
 * -----------------------------------------------------------------------
 * Pasang di Note box Actor, Enemy, Class, Skill, atau Item:
 *
 *   <Element:Fire>
 *   <Element:Wind>
 *   <Element:Earth>
 *   <Element:Water>
 *   <Element:Neutral>
 *
 * Nama elemen HARUS sama persis dengan salah satu nilai di parameter
 * "Cycle Order" (default: Fire, Wind, Earth, Water). "Neutral" selalu
 * bisa dipakai kapan pun (misal untuk Tasya) dan tidak pernah mendapat
 * atau memberi bonus/malus elemen.
 *
 * Prioritas pencarian elemen SKILL/ITEM:
 *   1. Notetag <Element:x> di skill/item itu sendiri.
 *   2. Jika tidak ada, skill dianggap non-elemental (rate selalu 100%,
 *      dipakai untuk physical attack biasa / heal / buff).
 *
 * Prioritas pencarian elemen TARGET (actor maupun enemy):
 *   1. Notetag <Element:x> di data Actor/Enemy itu sendiri.
 *   2. Untuk Actor, jika tidak ada di Actor, dicek juga notetag di
 *      Class-nya saat ini.
 *   3. Jika tetap tidak ditemukan, dianggap Neutral (100%, tidak ada
 *      interaksi elemen).
 *
 * -----------------------------------------------------------------------
 * CONTOH SETUP SESUAI GDD
 * -----------------------------------------------------------------------
 *   Actor "Joko"  -> Note: <Element:Water>
 *   Actor "Rudi"  -> Note: <Element:Fire>
 *   Actor "Tarno" -> Note: <Element:Earth>
 *   Actor "Banyu" -> Note: <Element:Wind>
 *   Actor "Tasya" -> Note: <Element:Neutral>
 *
 *   Skill "Water Slash" (milik Joko) -> Note: <Element:Water>
 *   Skill "Fireball"    (milik Rudi) -> Note: <Element:Fire>
 *
 *   Enemy "Salamander" -> Note: <Element:Fire>
 *   Enemy "Sylph"       -> Note: <Element:Wind>
 *
 * Dengan setup di atas, saat Joko (Water) memakai skill "Water Slash"
 * (Water) ke Salamander (Fire), plugin otomatis menghitung: Water
 * mengalahkan Fire dalam siklus => ADVANTAGE => damage x1.5, plus
 * popup "WEAK POINT!" muncul di atas kepala musuh.
 *
 * -----------------------------------------------------------------------
 * CATATAN INTEGRASI
 * -----------------------------------------------------------------------
 * Plugin ini TIDAK memakai sistem Element ID bawaan RPG Maker MV
 * (tab Types > Elements di database) supaya afinitas party/enemy bisa
 * diatur cukup lewat notetag tanpa perlu setting trait "Element Rate"
 * satu-satu di tiap actor/enemy. Skill/Item yang tidak diberi notetag
 * <Element:x> akan tetap berjalan seperti biasa (memakai Element ID
 * bawaan MV jika ada, damage normal jika tidak).
 *
 * -----------------------------------------------------------------------
 * TROUBLESHOOTING: "Damage-nya gede tapi nggak ada tanda efektif/enggak"
 * -----------------------------------------------------------------------
 * Ini SELALU berarti salah satu dari dua notetag berikut belum terpasang
 * (atau typo):
 *   1. Skill yang dipakai TIDAK punya <Element:x> di Note box-nya, ATAU
 *   2. Enemy yang diserang TIDAK punya <Element:x> di Note box-nya.
 * Kalau salah satu kosong, plugin otomatis lewat (damage normal RPG Maker
 * MV biasa, TANPA popup WEAK POINT/RESIST) - damage besar dalam kasus ini
 * murni dari ATK/formula skill, bukan dari efektivitas elemen.
 *
 * Nyalakan parameter "Debug Log" ke true, lalu buka Console browser/
 * Playtest (F8) untuk lihat elemen apa yang terbaca dari skill & target
 * setiap kali menyerang. Kalau tertulis "null" berarti notetag belum
 * kebaca (biasanya typo format, harus persis <Element:Fire>).
 *
 * Free to use & modify untuk keperluan skripsi/thesis project ini.
 * =============================================================================
 */

(() => {
  'use strict';

  const PLUGIN_NAME = 'ElementalAffinityCycle';
  const params = PluginManager.parameters(PLUGIN_NAME);

  const CYCLE = JSON.parse(params['Cycle Order'] || '["Fire","Wind","Earth","Water"]')
    .map(e => String(e).trim());

  const RATE_ADVANTAGE = Number(params['Advantage Rate'] || 150) / 100;
  const RATE_DISADVANTAGE = Number(params['Disadvantage Rate'] || 50) / 100;
  const RATE_NEUTRAL_DIAGONAL = Number(params['Neutral Diagonal Rate'] || 100) / 100;
  const RATE_SAME_ELEMENT = Number(params['Same Element Rate'] || 100) / 100;

  const SHOW_POPUP = params['Show Popup'] === 'true';
  const WEAK_TEXT = params['Weak Popup Text'] || 'WEAK POINT!';
  const RESIST_TEXT = params['Resist Popup Text'] || 'RESIST';

  const SHOW_PARTY_BADGE = params['Show Party Affinity Badge'] === 'true';
  const SHOW_ENEMY_BADGE = params['Show Enemy Affinity Badge'] === 'true';
  const ELEMENT_COLORS = JSON.parse(params['Element Colors'] ||
    '{"Fire":"#ff6b4a","Wind":"#7be0c9","Earth":"#c98a4b","Water":"#4a9bff","Neutral":"#aaaaaa"}');
  const DEBUG_LOG = params['Debug Log'] === 'true';

  const NEUTRAL_KEYWORD = 'neutral';

  //---------------------------------------------------------------------
  // Util: baca notetag <Element:x> dari sebuah data object (actor/enemy/
  // class/skill/item). Mengembalikan string element atau null.
  //---------------------------------------------------------------------
  function readElementNote(dataObj) {
    if (!dataObj || !dataObj.note) return null;
    const match = dataObj.note.match(/<Element:\s*([A-Za-z]+)\s*>/i);
    if (!match) return null;
    return match[1];
  }

  //---------------------------------------------------------------------
  // Baca notetag <PhaseElement:x> - dipakai Floor Guardian (boss) untuk
  // mengganti elemen kelemahan secara PERMANEN begitu HP <= 50%.
  //---------------------------------------------------------------------
  function readPhaseElementNote(dataObj) {
    if (!dataObj || !dataObj.note) return null;
    const match = dataObj.note.match(/<PhaseElement:\s*([A-Za-z]+)\s*>/i);
    return match ? match[1] : null;
  }

  //---------------------------------------------------------------------
  // Ambil elemen sebuah skill/item yang sedang dipakai dalam Game_Action
  //---------------------------------------------------------------------
  function getActionElement(action) {
    const item = action.item();
    return readElementNote(item);
  }

  //---------------------------------------------------------------------
  // Ambil elemen afinitas seorang battler (actor atau enemy)
  //---------------------------------------------------------------------
  function getBattlerElement(battler) {
    if (!battler) return null;
    // Runtime override (dipakai fitur shifting element / dual-phase boss) -
    // prioritas tertinggi, di atas notetag statis.
    if (battler._elementOverride) return battler._elementOverride;
    if (battler.isActor && battler.isActor()) {
      const actorData = battler.actor();
      const fromActor = readElementNote(actorData);
      if (fromActor) return fromActor;
      const classData = battler.currentClass ? battler.currentClass() : null;
      const fromClass = readElementNote(classData);
      if (fromClass) return fromClass;
      return null;
    } else if (battler.isEnemy && battler.isEnemy()) {
      return readElementNote(battler.enemy());
    }
    return null;
  }

  //---------------------------------------------------------------------
  // DUAL-PHASE BOSS: begitu HP enemy <= 50%, elemen kelemahannya berganti
  // permanen ke <PhaseElement:x>. Dipasang lewat hook onDamage (dipanggil
  // setiap kali battler menerima damage HP).
  //---------------------------------------------------------------------
  const _Game_Enemy_onDamage = Game_Enemy.prototype.onDamage;
  Game_Enemy.prototype.onDamage = function(value) {
    _Game_Enemy_onDamage.call(this, value);
    try {
      if (this._phaseActivated || !this.isAlive()) return;
      const phaseElement = readPhaseElementNote(this.enemy());
      if (phaseElement && this.hpRate() <= 0.5) {
        this._phaseActivated = true;
        this._elementOverride = phaseElement;
        if (BattleManager._logWindow) {
          BattleManager._logWindow.push('addText',
            this.name() + ' shifts its affinity to ' + phaseElement + '!');
        }
        if (DEBUG_LOG) {
          console.log('[ElementalAffinityCycle] ' + this.name() +
            ' memasuki Phase 2, elemen berganti ke ' + phaseElement);
        }
      }
    } catch (e) {
      if (DEBUG_LOG) console.log('[ElementalAffinityCycle] Gagal proses dual-phase:', e);
    }
  };

  //---------------------------------------------------------------------
  // Hitung index elemen di dalam array siklus. -1 jika tidak ditemukan
  // atau jika elemen adalah "Neutral".
  //---------------------------------------------------------------------
  function cycleIndex(elementName) {
    if (!elementName) return -1;
    if (elementName.toLowerCase() === NEUTRAL_KEYWORD) return -1;
    return CYCLE.findIndex(e => e.toLowerCase() === elementName.toLowerCase());
  }

  //---------------------------------------------------------------------
  // Inti logika: hitung rate dan tipe hasil ('advantage' | 'disadvantage'
  // | 'neutral' | 'same') dari elemen skill vs elemen target.
  //---------------------------------------------------------------------
  function computeElementalResult(skillElement, targetElement) {
    // Salah satu tidak elemental / neutral => tidak ada interaksi
    if (!skillElement || !targetElement) {
      return { rate: 1, type: 'neutral' };
    }
    if (skillElement.toLowerCase() === NEUTRAL_KEYWORD ||
        targetElement.toLowerCase() === NEUTRAL_KEYWORD) {
      return { rate: 1, type: 'neutral' };
    }

    const skillIdx = cycleIndex(skillElement);
    const targetIdx = cycleIndex(targetElement);
    const n = CYCLE.length;

    if (skillIdx === -1 || targetIdx === -1) {
      return { rate: 1, type: 'neutral' };
    }

    if (skillIdx === targetIdx) {
      return { rate: RATE_SAME_ELEMENT, type: 'same' };
    }

    // Skill mengalahkan target jika target berada tepat SATU langkah
    // di depan skill dalam siklus (searah jarum jam)
    if ((skillIdx + 1) % n === targetIdx) {
      return { rate: RATE_ADVANTAGE, type: 'advantage' };
    }

    // Target mengalahkan skill jika sebaliknya
    if ((targetIdx + 1) % n === skillIdx) {
      return { rate: RATE_DISADVANTAGE, type: 'disadvantage' };
    }

    // Sisanya (beda 2 langkah dalam siklus 4 elemen) = hubungan diagonal
    return { rate: RATE_NEUTRAL_DIAGONAL, type: 'neutral' };
  }

  //---------------------------------------------------------------------
  // Override inti: Game_Action.prototype.calcElementRate
  //---------------------------------------------------------------------
  const _Game_Action_calcElementRate = Game_Action.prototype.calcElementRate;
  Game_Action.prototype.calcElementRate = function(target) {
    const skillElement = getActionElement(this);

    // Kalau skill tidak punya notetag elemen, biarkan behavior asli MV
    // yang jalan (physical attack biasa, buff, heal, dst).
    if (!skillElement) {
      if (DEBUG_LOG) {
        console.log('[ElementalAffinityCycle] Skill "' + this.item().name +
          '" tidak punya notetag <Element:x> -> pakai rate default MV.');
      }
      // PENTING: bersihkan tag hasil elemental LAMA di target ini kalau ada.
      // Tanpa ini, tag "advantage/disadvantage" dari serangan elemental
      // sebelumnya bisa "nyangkut" dan salah kebaca oleh sistem lain
      // (popup WEAK POINT, histori Fuzzy DDA) seolah aksi non-elemental
      // ini juga elemental.
      if (target) {
        target._elementalCycleResult = null;
      }
      return _Game_Action_calcElementRate.call(this, target);
    }

    const targetElement = getBattlerElement(target);
    const result = computeElementalResult(skillElement, targetElement);

    if (DEBUG_LOG) {
      console.log('[ElementalAffinityCycle] skill="' + this.item().name +
        '" skillElement=' + skillElement + ' target="' + target.name() +
        '" targetElement=' + targetElement + ' -> ' + result.type +
        ' (x' + result.rate + ')');
    }

    // Simpan hasil sementara di target supaya bisa dibaca oleh sistem
    // popup damage (Sprite_Damage) setelah damage dihitung.
    target._elementalCycleResult = result.type;

    return result.rate;
  };

  //---------------------------------------------------------------------
  // Popup "WEAK POINT!" / "RESIST" di atas battler
  //---------------------------------------------------------------------
  // Teknik: sprite teks ditempel sebagai CHILD LANGSUNG dari Sprite_Actor/
  // Sprite_Enemy (persis seperti badge elemen di atas musuh), bukan
  // dicantolkan ke sistem Sprite_Damage bawaan MV. Ini menghindari 2 sumber
  // masalah: (1) loop fisika Sprite_Damage yang merusak child tanpa
  // properti `dy`, dan (2) ketidakpastian timing/parent kalau nempel di
  // level Sprite_Battler.setupDamagePopup.
  //---------------------------------------------------------------------
  if (SHOW_POPUP) {
    const _Sprite_Battler_update = Sprite_Battler.prototype.update;
    Sprite_Battler.prototype.update = function() {
      this.checkElementalFlagPopup();
      _Sprite_Battler_update.call(this);
    };

    Sprite_Battler.prototype.checkElementalFlagPopup = function() {
      const battler = this._battler;
      if (!battler) return;
      try {
        const resultType = battler._elementalCycleResult;
        if (resultType === 'advantage' || resultType === 'disadvantage') {
          const requested = !!(battler.isDamagePopupRequested && battler.isDamagePopupRequested());
          if (DEBUG_LOG) {
            console.log('[ElementalAffinityCycle][POPUP-CHECK] battler=' +
              (battler.name ? battler.name() : '?') + ' resultType=' + resultType +
              ' isDamagePopupRequested=' + requested);
          }
          if (requested) {
            this.createElementalFlagPopup(resultType);
            if (DEBUG_LOG) {
              console.log('[ElementalAffinityCycle][POPUP-CHECK] createElementalFlagPopup() dipanggil, sprite ditambahkan.');
            }
            battler._elementalCycleResult = null;
          }
        }
      } catch (e) {
        console.log('[ElementalAffinityCycle] Popup ERROR:', e);
      }
    };

    Sprite_Battler.prototype.createElementalFlagPopup = function(resultType) {
      const width = 180;
      const height = 44;
      const sprite = new Sprite(new Bitmap(width, height));
      const text = resultType === 'advantage' ? WEAK_TEXT : RESIST_TEXT;
      const color = resultType === 'advantage' ? '#ffe066' : '#8899aa';

      sprite.bitmap.fontSize = 22;
      sprite.bitmap.fontBold = true;
      sprite.bitmap.textColor = color;
      sprite.bitmap.outlineColor = 'rgba(0,0,0,0.8)';
      sprite.bitmap.outlineWidth = 5;
      sprite.bitmap.drawText(text, 0, 0, width, height, 'center');

      sprite.anchor.x = 0.5;
      sprite.anchor.y = 1;
      sprite.x = 0;
      const bitmapHeight = this.bitmap ? this.bitmap.height : 80;
      sprite.y = -bitmapHeight - 24;

      sprite._elementalFlagDuration = 70;
      sprite.update = function() {
        this._elementalFlagDuration--;
        this.y -= 0.4;
        if (this._elementalFlagDuration < 20) {
          this.opacity = Math.max(0, 255 * this._elementalFlagDuration / 20);
        }
        if (this._elementalFlagDuration <= 0 && this.parent) {
          this.parent.removeChild(this);
        }
      };

      this.addChild(sprite);
    };
  }

  //---------------------------------------------------------------------
  // Util UI: warna & singkatan per elemen, dipakai badge
  //---------------------------------------------------------------------
  const ELEMENT_ABBREV_MAP = { fire: 'FIR', wind: 'WND', earth: 'ERT', water: 'WTR', neutral: 'NEU' };

  function elementAbbrev(elementName) {
    if (!elementName) return '?';
    const key = elementName.toLowerCase();
    if (ELEMENT_ABBREV_MAP[key]) return ELEMENT_ABBREV_MAP[key];
    return elementName.substring(0, 3).toUpperCase();
  }

  function elementColor(elementName) {
    if (!elementName) return '#666666';
    const key = Object.keys(ELEMENT_COLORS).find(
      k => k.toLowerCase() === elementName.toLowerCase()
    );
    return key ? ELEMENT_COLORS[key] : '#666666';
  }

  //---------------------------------------------------------------------
  // Badge elemen di Window_BattleStatus (party), pojok kanan tiap baris
  //---------------------------------------------------------------------
  if (SHOW_PARTY_BADGE) {
    const _Window_BattleStatus_drawItem = Window_BattleStatus.prototype.drawItem;
    Window_BattleStatus.prototype.drawItem = function(index) {
      _Window_BattleStatus_drawItem.call(this, index);

      // Pengecekan defensif: kalau ada plugin lain yang mengubah struktur
      // Window_BattleStatus (misal plugin UI battle custom) sehingga method
      // .actor()/.itemRect() tidak tersedia seperti versi vanilla MV, badge
      // ini akan dilewati saja (bukan bikin game crash).
      if (typeof this.actor !== 'function' || typeof this.itemRect !== 'function') {
        return;
      }

      try {
        const actor = this.actor(index);
        if (!actor) return;
        const element = getBattlerElement(actor);
        if (!element) return;

        const rect = this.itemRect(index);
        const badgeWidth = 40;
        const badgeHeight = 18;
        const x = rect.x + rect.width - badgeWidth - 6;
        const y = rect.y + 4;

        this.contents.fillRect(x, y, badgeWidth, badgeHeight, elementColor(element));
        this.contents.fontSize = 13;
        this.changeTextColor('#222222');
        this.drawText(elementAbbrev(element), x, y - 2, badgeWidth, badgeHeight, 'center');
        this.resetFontSettings();
      } catch (e) {
        // Diamkan saja error dari badge, jangan sampai bikin battle crash.
        if (DEBUG_LOG) {
          console.log('[ElementalAffinityCycle] Party badge dilewati (incompatible window):', e);
        }
      }
    };
  }

  //---------------------------------------------------------------------
  // Badge elemen di atas sprite musuh
  //---------------------------------------------------------------------
  if (SHOW_ENEMY_BADGE) {
    const _Sprite_Enemy_update = Sprite_Enemy.prototype.update;
    Sprite_Enemy.prototype.update = function() {
      _Sprite_Enemy_update.call(this);
      this.updateElementalAffinityBadge();
    };

    Sprite_Enemy.prototype.updateElementalAffinityBadge = function() {
      if (!this._enemy) return;

      try {
        if (!this._elementBadgeSprite) {
          const sprite = new Sprite(new Bitmap(70, 22));
          sprite.anchor.x = 0.5;
          sprite.anchor.y = 1;
          this._elementBadgeDrawn = undefined;
          this._elementBadgeSprite = sprite;
          this.addChild(sprite);
        }

        const element = getBattlerElement(this._enemy);
        if (element !== this._elementBadgeDrawn) {
          this._elementBadgeDrawn = element;
          const bmp = this._elementBadgeSprite.bitmap;
          bmp.clear();
          if (element) {
            bmp.fillRect(0, 0, 70, 22, elementColor(element));
            bmp.fontSize = 14;
            bmp.fontBold = true;
            bmp.textColor = '#222222';
            bmp.drawText(elementAbbrev(element), 0, 2, 70, 18, 'center');
          }
        }

        const bitmapHeight = this.bitmap ? this.bitmap.height : 0;
        this._elementBadgeSprite.x = 0;
        this._elementBadgeSprite.y = -bitmapHeight - 8;
        this._elementBadgeSprite.visible = this.visible;
      } catch (e) {
        if (DEBUG_LOG) {
          console.log('[ElementalAffinityCycle] Enemy badge dilewati (incompatible sprite):', e);
        }
      }
    };
  }

  //---------------------------------------------------------------------
  // Expose helper ke global scope, siapa tahu dibutuhkan plugin lain
  // (misal plugin Fuzzy DDA di tahap berikutnya) untuk baca afinitas.
  //---------------------------------------------------------------------
  window.ElementalAffinityCycle = {
    getActionElement,
    getBattlerElement,
    computeElementalResult,
    CYCLE
  };

})();
