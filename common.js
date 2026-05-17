const KAKAO_KEY = 'f3f8fa6decb5e2185b09d6bf70ef525b';

// 인앱 브라우저 감지 → Chrome/Safari 안내
(function () {
  var ua = navigator.userAgent || '';
  var isInApp = /KAKAOTALK|NAVER|FBAN|FBAV|Instagram|Line\//i.test(ua);
  if (!isInApp) return;
  var isAndroid = /Android/i.test(ua);
  function show() {
    if (document.getElementById('inAppWarn')) return;
    var url = location.href;
    var intentUrl = isAndroid
      ? 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end'
      : null;
    var html = '<div id="inAppWarn" style="position:fixed;inset:0;background:rgba(20,30,50,0.96);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;">'
      + '<div style="background:#fff;border-radius:12px;padding:24px;max-width:340px;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,0.3);">'
      + '<div style="font-size:42px;margin-bottom:8px;">⚠️</div>'
      + '<h2 style="color:#2c3e50;margin-bottom:10px;font-size:17px;">크롬으로 열어주세요</h2>'
      + '<p style="color:#555;font-size:13px;line-height:1.5;margin-bottom:16px;">'
      + '카카오톡/네이버 등 인앱 브라우저에서는<br><b style="color:#e74c3c;">GPS 추적이 작동하지 않습니다.</b></p>'
      + (isAndroid
        ? '<button onclick="location.href=\'' + intentUrl + '\'" style="background:#27ae60;color:#fff;border:none;padding:12px 18px;border-radius:6px;font-size:14px;font-weight:600;width:100%;cursor:pointer;">Chrome으로 바로 열기</button>'
        : '<p style="color:#2c3e50;font-size:13px;background:#f0f4f8;padding:10px;border-radius:6px;text-align:left;">우측 상단 <b>···</b> 또는 <b>↗</b> 메뉴를 누르고<br><b>"Safari로 열기"</b>를 선택하세요.</p>')
      + '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }
  if (document.body) show();
  else document.addEventListener('DOMContentLoaded', show);
})();

// 기본 데이터
var defaultConfig = { gpsIntervalSec: 15, staleMinutes: 10 };

// Firebase 동기화
var _cache = {};
var _cacheReady = false;
var _readyCallbacks = [];
var _syncInitialized = false;

function initFirebaseSync() {
  if (_syncInitialized) return;
  if (typeof fbDb === 'undefined') return;
  _syncInitialized = true;
  fbDb.ref('/').on('value', function(snapshot) {
    _cache = snapshot.val() || {};
    if (!_cache.config) {
      _cache.config = Object.assign({}, defaultConfig);
      fbDb.ref('/config').set(_cache.config);
    }
    if (!_cacheReady) {
      _cacheReady = true;
      _readyCallbacks.forEach(function(cb) { cb(); });
      _readyCallbacks.length = 0;
    }
    if (window.onDataChanged) window.onDataChanged();
  });
}

function onDataReady(cb) {
  if (_cacheReady) cb();
  else _readyCallbacks.push(cb);
}

function getChildren() {
  var ch = _cache.children || {};
  return Object.keys(ch).map(function(k) { return Object.assign({ id: k }, ch[k]); })
    .sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
}

function getPins() {
  var p = _cache.pins || {};
  return Object.keys(p).map(function(k) { return Object.assign({ id: k }, p[k]); })
    .sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
}

function getParents() {
  var p = _cache.parents || {};
  return Object.keys(p).map(function(k) { return Object.assign({ id: k }, p[k]); })
    .sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
}

function getLocations() {
  return _cache.locations || {};
}

function getChildPins() {
  var p = _cache.childPins || {};
  return Object.keys(p).map(function(k) { return Object.assign({ id: k }, p[k]); })
    .sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
}

function getParentLocations() {
  return _cache.parentLocations || {};
}

function getConfig() {
  return _cache.config || Object.assign({}, defaultConfig);
}

// 4자리 접속 코드 생성 (숫자+대문자, 혼동문자 제외)
function generateCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var children = getChildren();
  var existing = children.map(function(c) { return c.code || ''; });
  var code;
  do {
    code = '';
    for (var i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (existing.indexOf(code) !== -1);
  return code;
}

function findChildByCode(code) {
  if (!code) return null;
  var upper = code.toUpperCase().trim();
  return getChildren().find(function(c) { return (c.code || '').toUpperCase() === upper; }) || null;
}

// 유틸
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function distance(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var toRad = function(x) { return x * Math.PI / 180; };
  var dLat = toRad(lat2 - lat1);
  var dLng = toRad(lng2 - lng1);
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timeAgo(ts) {
  if (!ts) return '알 수 없음';
  var diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return '방금';
  if (diff < 60) return diff + '초 전';
  if (diff < 3600) return Math.floor(diff / 60) + '분 전';
  if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
  return Math.floor(diff / 86400) + '일 전';
}

function isStale(ts) {
  if (!ts) return true;
  var cfg = getConfig();
  return Date.now() - ts > (cfg.staleMinutes || 10) * 60000;
}

// Wake Lock
var _wakeLock = null;
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      _wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (e) {}
}
function releaseWakeLock() {
  if (_wakeLock) { _wakeLock.release(); _wakeLock = null; }
}

// 관리자 PIN 체크 (admin.html 전용)
function showAdminPinGate(onSuccess) {
  var saved = localStorage.getItem('kids_admin_pin');
  onDataReady(function() {
    var cfg = getConfig();
    if (!cfg.adminPin) { onSuccess(); return; }
    if (saved === cfg.adminPin) { onSuccess(); return; }
    localStorage.removeItem('kids_admin_pin');
    _showAdminPinUI(onSuccess);
  });
}

function _showAdminPinUI(onSuccess) {
  var html = '<div class="pin-gate" id="pinGate">'
    + '<div class="pin-box">'
    + '<div style="font-size:42px;margin-bottom:8px;">🔧</div>'
    + '<h2 style="color:#2c3e50;margin-bottom:10px;">관리자 PIN</h2>'
    + '<input id="pinInput" type="password" inputmode="numeric" maxlength="10" placeholder="PIN" '
    + 'style="text-align:center;font-size:18px;letter-spacing:4px;" '
    + 'onkeydown="if(event.key===\'Enter\')checkAdminPin()">'
    + '<div id="pinErr" style="color:#e74c3c;font-size:12px;margin-top:6px;min-height:16px;"></div>'
    + '<button onclick="checkAdminPin()" style="width:100%;margin-top:8px;padding:10px;">확인</button>'
    + '</div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
  setTimeout(function() { document.getElementById('pinInput').focus(); }, 100);

  window.checkAdminPin = function() {
    var val = document.getElementById('pinInput').value;
    var cfg = getConfig();
    if (val === cfg.adminPin) {
      localStorage.setItem('kids_admin_pin', val);
      document.getElementById('pinGate').remove();
      onSuccess();
    } else {
      document.getElementById('pinErr').textContent = 'PIN이 올바르지 않습니다';
      document.getElementById('pinInput').value = '';
    }
  };
}

// 카카오 InfoWindow 토글
window.__openIw = null;
function toggleInfoWindow(iw, marker, mapRef) {
  if (iw.getMap && iw.getMap()) {
    iw.close();
    if (window.__openIw === iw) window.__openIw = null;
  } else {
    if (window.__openIw && window.__openIw !== iw) {
      try { window.__openIw.close(); } catch (e) {}
    }
    iw.open(mapRef, marker);
    window.__openIw = iw;
    try {
      if (mapRef && marker.getPosition) {
        setTimeout(function() {
          mapRef.panTo(marker.getPosition());
          setTimeout(function() { mapRef.panBy(0, -80); }, 200);
        }, 50);
      }
    } catch (e) {}
  }
}

// 카카오내비 열기
function openKakaoNavi(name, lat, lng) {
  var ua = navigator.userAgent;
  if (/iPhone|iPad|Android/.test(ua)) {
    location.href = 'kakaomap://route?ep=' + lat + ',' + lng + '&by=CAR';
  } else {
    window.open('https://map.kakao.com/link/to/' + encodeURIComponent(name) + ',' + lat + ',' + lng);
  }
}

// 이모지 마커 이미지
function emojiMarkerImage(emoji, color, size) {
  size = size || 32;
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + (size + 10) + '" viewBox="0 0 ' + size + ' ' + (size + 10) + '">'
    + '<path d="M' + (size/2) + ' 0 C' + (size*0.23) + ' 0 0 ' + (size*0.23) + ' 0 ' + (size/2)
    + ' C0 ' + (size*0.82) + ' ' + (size/2) + ' ' + (size+10) + ' ' + (size/2) + ' ' + (size+10)
    + ' C' + (size/2) + ' ' + (size+10) + ' ' + size + ' ' + (size*0.82) + ' ' + size + ' ' + (size/2)
    + ' C' + size + ' ' + (size*0.23) + ' ' + (size*0.77) + ' 0 ' + (size/2) + ' 0 Z" fill="' + color + '" stroke="white" stroke-width="1.5"/>'
    + '<text x="' + (size/2) + '" y="' + (size*0.62) + '" font-size="' + (size*0.45) + '" text-anchor="middle">' + emoji + '</text>'
    + '</svg>';
  return new kakao.maps.MarkerImage(
    'data:image/svg+xml;utf8,' + encodeURIComponent(svg),
    new kakao.maps.Size(size, size + 10),
    { offset: new kakao.maps.Point(size/2, size + 10) }
  );
}

function pinMarkerImage(emoji, color) {
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34">'
    + '<path d="M13 0 C6 0 0 6 0 13 C0 22 13 34 13 34 C13 34 26 22 26 13 C26 6 20 0 13 0 Z" fill="' + color + '" stroke="white" stroke-width="1.5"/>'
    + '<text x="13" y="18" font-size="13" text-anchor="middle">' + emoji + '</text>'
    + '</svg>';
  return new kakao.maps.MarkerImage(
    'data:image/svg+xml;utf8,' + encodeURIComponent(svg),
    new kakao.maps.Size(26, 34),
    { offset: new kakao.maps.Point(13, 34) }
  );
}

// 카테고리 기본값
var PIN_CATEGORIES = [
  { value: 'home', label: '집', emoji: '🏠', color: '#e74c3c' },
  { value: 'school', label: '학교', emoji: '🏫', color: '#f39c12' },
  { value: 'academy', label: '학원', emoji: '📚', color: '#9b59b6' },
  { value: 'work', label: '회사', emoji: '🏢', color: '#2c3e50' },
  { value: 'other', label: '기타', emoji: '📍', color: '#7f8c8d' }
];

var CHILD_COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8'];
var CHILD_EMOJIS = ['🐻','🐰','🦊','🐼','🐶','🐱','🐸'];
