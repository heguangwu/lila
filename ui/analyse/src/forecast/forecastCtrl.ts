import { prop } from 'common';
import { AnalyseData } from '../interfaces';

export interface ForecastController {
  addNodes(fc): void;
  reloadToLastPly(): void;
  [key: string]: any; // #TODO
}

export function make(cfg, data: AnalyseData, redraw: () => void): ForecastController {

  const saveUrl = `/${data.game.id}${data.player.id}/forecasts`;

  let forecasts = cfg.steps || [];
  const loading = prop(false);

  function keyOf(fc) {
    return fc.map(node => node.ply + ':' + node.uci).join(',');
  };

  function contains(fc1, fc2) {
    return fc1.length >= fc2.length && keyOf(fc1).indexOf(keyOf(fc2)) === 0;
  };

  function findStartingWithNode(node) {
    return forecasts.filter(function(fc) {
      return contains(fc, [node]);
    });
  };

  function collides(fc1, fc2) {
    for (var i = 0, max = Math.min(fc1.length, fc2.length); i < max; i++) {
      if (fc1[i].uci !== fc2[i].uci) {
        if (cfg.onMyTurn) return i !== 0 && i % 2 === 0;
        return i % 2 === 1;
      }
    }
    return true;
  };

  function truncate(fc) {
    if (cfg.onMyTurn)
    return (fc.length % 2 !== 1 ? fc.slice(0, -1) : fc).slice(0, 30);
    // must end with player move
    return (fc.length % 2 !== 0 ? fc.slice(0, -1) : fc).slice(0, 30);
  };

  function isLongEnough(fc) {
    return fc.length >= (cfg.onMyTurn ? 1 : 2);
  };

  function fixAll() {
    // remove contained forecasts
    forecasts = forecasts.filter(function(fc, i) {
      return forecasts.filter(function(f, j) {
        return i !== j && contains(f, fc)
      }).length === 0;
    });
    // remove colliding forecasts
    forecasts = forecasts.filter(function(fc, i) {
      return forecasts.filter(function(f, j) {
        return i < j && collides(f, fc)
      }).length === 0;
    });
  };
  fixAll();

  function reloadToLastPly() {
    loading(true);
    redraw();
    history.replaceState(null, '', '#last');
    window.lichess.reload();
  };

  function isCandidate(fc) {
    fc = truncate(fc);
    if (!isLongEnough(fc)) return false;
    var collisions = forecasts.filter(function(f) {
      return contains(f, fc);
    });
    if (collisions.length) return false;
    return true;
  };

  function save() {
    if (cfg.onMyTurn) return;
    loading(true);
    redraw();
    $.ajax({
      method: 'POST',
      url: saveUrl,
      data: JSON.stringify(forecasts),
      contentType: 'application/json'
    }).then(function(data) {
      if (data.reload) reloadToLastPly();
      else {
        loading(false);
        forecasts = data.steps || [];
      }
      redraw();
    });
  };

  function playAndSave(node) {
    if (!cfg.onMyTurn) return;
    loading(true);
    redraw();
    $.ajax({
      method: 'POST',
      url: saveUrl + '/' + node.uci,
      data: JSON.stringify(findStartingWithNode(node).filter(function(fc) {
        return fc.length > 1;
      }).map(function(fc) {
        return fc.slice(1);
      })),
      contentType: 'application/json'
    }).then(function(data) {
      if (data.reload) reloadToLastPly();
      else {
        loading(false);
        forecasts = data.steps || [];
      }
      redraw();
    });
  };

  return {
    addNodes(fc): void {
      fc = truncate(fc);
      if (!isCandidate(fc)) return;
      fc.forEach(function(node) {
        delete node.variations;
      });
      forecasts.push(fc);
      fixAll();
      save();
    },
    isCandidate,
    removeIndex(index) {
      forecasts = forecasts.filter((_, i) => i !== index)
        save();
    },
    list: () => forecasts,
    truncate,
    loading,
    onMyTurn: cfg.onMyTurn,
    findStartingWithNode,
    playAndSave,
    reloadToLastPly
  };
};
