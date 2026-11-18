// app.jsx — PerfectStorm UI shell
// Wires engine + audio + scene together with a single-screen layout.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "treatment": "streak",
  "horizon": true,
  "palette": "midnight",
  "showSubtitle": true
}/*EDITMODE-END*/;

// ─── icons ───────────────────────────────────────────────
const Icon = {
  play: (
    <svg width="11" height="13" viewBox="0 0 11 13"><path d="M0 0L11 6.5L0 13Z" fill="currentColor"/></svg>
  ),
  pause: (
    <svg width="10" height="13" viewBox="0 0 10 13"><rect width="3.5" height="13" fill="currentColor"/><rect x="6.5" width="3.5" height="13" fill="currentColor"/></svg>
  ),
  reset: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M11.5 6.5A5 5 0 1 1 6.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M6.5 0L9.5 1.5L6.5 3.5Z" fill="currentColor"/>
    </svg>
  ),
  bolt: (
    <svg width="9" height="13" viewBox="0 0 9 13"><path d="M5 0H1L0 7H3L2 13L9 5H5L7 0H5Z" fill="currentColor"/></svg>
  ),
  inbox: (
    <svg width="14" height="13" viewBox="0 0 14 13" fill="none">
      <path d="M1 8V12H13V8M1 8L3 1H11L13 8M1 8H5L6 9.5H8L9 8H13" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  ),
};

// ─── small components ────────────────────────────────────
function Slider({label, hint, value, min, max, step, unit, fmt, onChange}){
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider-row">
      <div className="slider-lbl">
        <span className="nm">{label}</span>
        <span className="vl">{fmt ? fmt(value) : (value.toFixed(step < 1 ? 2 : 0) + (unit||''))}</span>
      </div>
      <input type="range" className="rng"
        min={min} max={max} step={step} value={value}
        style={{'--pct': pct + '%'}}
        onChange={(e)=> onChange(parseFloat(e.target.value))}/>
      {hint && <div className="slider-lbl"><span className="hint">{hint}</span></div>}
    </div>
  );
}

function Metric({k, v, sub, mod}){
  return (
    <div className={"metric" + (mod ? " " + mod : "")}>
      <div className="k">{k}</div>
      <div className="v">{v}{sub && <small>{sub}</small>}</div>
    </div>
  );
}

function Switch({on, onChange}){
  return <div className={"switch" + (on ? " on" : "")} onClick={()=>onChange(!on)} role="switch" aria-checked={on}/>;
}

// ─── start overlay ───────────────────────────────────────
function StartOverlay({onStart, onSilent}){
  return (
    <div className="start-overlay">
      <div className="start-card">
        <div style={{fontFamily:'var(--font-mono)', fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--fg-faint)'}}>PerfectStorm · v0.1</div>
        <h2>An epidemic you can hear</h2>
        <p>Every case becomes a single droplet. As incidence rises, drops collapse into rain. Variants strike as thunder.</p>
        <div style={{display:'flex', gap:8, marginTop:6}}>
          <button className="btn primary" onClick={onStart}>{Icon.play}<span>Start with sound</span></button>
          <button className="btn ghost" onClick={onSilent}>Visual only</button>
        </div>
        <div style={{fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--fg-faint)', marginTop:8}}>headphones recommended</div>
      </div>
    </div>
  );
}

// ─── fixture for "real data" mode ────────────────────────
// Shaped like an Our-World-in-Data daily case series; values are synthetic.
const OWID_FIXTURE = {
  source: "OWID-shaped fixture",
  sourceUrl: "https://ourworldindata.org",
  pathogen: "Influenza A (illustrative)",
  geography: "Country · synthetic",
  dateRange: "2024-09-01 → 2024-12-15",
  license: "Illustrative — not real outbreak data",
  series: (function(){
    // generate a wave with a small second bump
    const days = 105;
    const arr = [];
    for (let i=0; i<days; i++){
      const x = i/days;
      const wave1 = Math.exp(-Math.pow((x-0.42)*4.5, 2)) * 1800;
      const wave2 = Math.exp(-Math.pow((x-0.78)*7, 2)) * 700;
      const noise = (Math.random()-0.5)*120;
      arr.push(Math.max(0, Math.floor(wave1 + wave2 + noise)));
    }
    return arr;
  })(),
};

// ─── main app ────────────────────────────────────────────
function App(){
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [started, setStarted] = useState(false);
  const [silent, setSilent] = useState(false);
  const [mode, setMode] = useState('sim'); // sim | data | story
  const [storyIdx, setStoryIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [snap, setSnap] = useState(null);
  const [soundOn, setSoundOn] = useState(true);
  const [volume, setVolume] = useState(0.7);
  const [flashKey, setFlashKey] = useState(0);

  // refs for engine / scene
  const engineRef = useRef(null);
  const sceneRef = useRef(null);
  const canvasRef = useRef(null);
  const dataTimerRef = useRef(null);

  // build engine + scene once
  useEffect(() => {
    const eng = PSEngine.makeEngine({ population: 100000 });
    engineRef.current = eng;
    const scn = PSScene.makeScene(canvasRef.current);
    sceneRef.current = scn;
    scn.start();

    // route engine events
    const off = eng.onCase((ev) => {
      if (ev && ev.kind === 'thunder'){
        scn.spawnLightning({ hue: ev.hue, intensity: ev.intensity || 1 });
        setFlashKey(k => k+1);
        if (!silent && PSAudio.isStarted()) PSAudio.playThunder({ intensity: ev.intensity });
        return;
      }
      // droplet event
      scn.spawnDrop({
        size: ev.visual.size,
        opacity: ev.visual.opacity,
        length: ev.visual.length,
        hue: ev.hue,
      });
      if (!silent && PSAudio.isStarted()) PSAudio.playDroplet(ev.audio);
    });

    // snapshot poller — 8Hz for UI
    const id = setInterval(() => {
      const s = eng.getSnapshot();
      setSnap(s);
      scn.setHistory(s.history);
    }, 120);

    return () => { off(); clearInterval(id); scn.stop(); };
  }, []);

  // apply tweak: scene treatment + horizon
  useEffect(() => {
    if (sceneRef.current) sceneRef.current.setStyle({
      treatment: t.treatment,
      showHorizon: t.horizon,
      hue: 230,
    });
  }, [t.treatment, t.horizon]);

  // audio volume / mute
  useEffect(() => {
    PSAudio.setVolume(volume);
    PSAudio.setMuted(!soundOn);
  }, [volume, soundOn]);

  const handleStart = useCallback(async () => {
    await PSAudio.start();
    setStarted(true);
    setSilent(false);
    engineRef.current.play();
    setPlaying(true);
  }, []);
  const handleSilent = useCallback(() => {
    setStarted(true);
    setSilent(true);
    setSoundOn(false);
    engineRef.current.play();
    setPlaying(true);
  }, []);

  const togglePlay = () => {
    const eng = engineRef.current;
    if (eng.isRunning()){ eng.pause(); setPlaying(false); }
    else { eng.play(); setPlaying(true); }
  };
  const resetSim = () => {
    engineRef.current.reset();
    sceneRef.current.clear();
  };

  const setP = (k, v) => engineRef.current.setParam(k, v);

  const introVariant = (id) => engineRef.current.introduceVariant(id);
  const importPulse = () => engineRef.current.importPulse(14);

  // ── real-data mode: stream the fixture as case events ──
  useEffect(() => {
    if (mode === 'data' && started){
      // pause sim engine while in data mode
      engineRef.current.pause();
      setPlaying(false);
      let i = 0;
      const series = OWID_FIXTURE.series;
      let acc = 0;
      const tick = () => {
        if (i >= series.length) i = 0;
        // scale: each day's value over 800ms, fire N drops
        const day = series[i];
        const N = Math.min(40, Math.ceil(day / 60));
        for (let k=0; k<N; k++){
          setTimeout(() => {
            sceneRef.current.spawnDrop({ size: 1, opacity: 0.85, length: 1.0, hue: 230 });
            if (!silent && PSAudio.isStarted()){
              PSAudio.playDroplet({
                gain: 0.6 + Math.random()*0.3,
                pitch: 0.9 + Math.random()*0.5,
                filter: 0.7,
                pan: (Math.random()-0.5)*1.4,
                tail: 0.2,
                transient: 0.7,
              });
            }
          }, k * (700/N));
        }
        i++;
      };
      tick();
      dataTimerRef.current = setInterval(tick, 800);
      return () => clearInterval(dataTimerRef.current);
    }
  }, [mode, started, silent]);

  // ── story mode: drive engine through chapters ──
  const applyStoryChapter = useCallback((idx) => {
    const arc = PSStory.arcs.covid;
    const ch = arc.chapters[idx];
    if (!ch) return;
    ch.apply(engineRef.current);
    if (!engineRef.current.isRunning()){
      engineRef.current.play();
      setPlaying(true);
    }
  }, []);

  useEffect(() => {
    if (mode === 'story' && started){
      applyStoryChapter(storyIdx);
    }
  }, [mode, storyIdx, started, applyStoryChapter]);

  const enterStory = () => {
    setMode('story');
    setStoryIdx(0);
    sceneRef.current.clear();
  };
  const nextChapter = () => {
    const max = PSStory.arcs.covid.chapters.length - 1;
    setStoryIdx(i => Math.min(max, i + 1));
  };
  const prevChapter = () => setStoryIdx(i => Math.max(0, i - 1));
  const restartStory = () => { setStoryIdx(0); sceneRef.current.clear(); applyStoryChapter(0); };

  // ── derived metrics ──
  const variants = snap ? snap.variants : [];
  const arc = PSStory.arcs.covid;
  const chapter = arc.chapters[storyIdx];
  const inStory = mode === 'story';

  return (
    <div className="app" data-mode={mode}>
      {/* ── STAGE ── */}
      <div className="stage">
        <canvas ref={canvasRef}/>
        <div className="vignette"/>
        <div className="grain"/>
        <div key={flashKey} className="flash fire"/>

        <div className="stage-hud">
          <div className="stage-top">
            <div className="title-block" data-dim={inStory}>
              <div className="brand"><span className="dot"/> PerfectStorm · {
                mode === 'sim' ? 'simulated outbreak' :
                mode === 'data' ? 'observed series' :
                'narrated arc · COVID-19'
              }</div>
              {!inStory && (
                <div style={{marginTop:20}}>
                  <div className="eyebrow">Auditory epidemiology</div>
                  <div className="title">
                    Every case is one drop.<br/>
                    Rain is what an outbreak <em>sounds&nbsp;like.</em>
                  </div>
                  {t.showSubtitle && (
                    <div className="subtitle">
                      A discrete-time SEIR model schedules droplet samples per infection. Variants and imports break the texture as thunder. Adjust the rail to hear the curve change.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mode-switch">
              <button className={mode==='sim' ? 'active' : ''} onClick={()=>setMode('sim')}>Simulate</button>
              <button className={mode==='data' ? 'active' : ''} onClick={()=>setMode('data')}>Observed</button>
              <button className={mode==='story' ? 'active' : ''} onClick={enterStory}>Story</button>
            </div>
          </div>

          {/* Story card */}
          {inStory && chapter && (
            <div className="story-card">
              <div className="story-stats">
                <div className="story-stat">
                  <span className="k">Day</span>
                  <span className="v">{snap ? Math.floor(snap.day).toString().padStart(3,'0') : '000'}</span>
                </div>
                <div className="story-stat">
                  <span className="k">Incidence</span>
                  <span className="v">{snap ? Math.round(snap.incidence).toLocaleString() : '—'}</span>
                </div>
                <div className="story-stat">
                  <span className="k">Immunity</span>
                  <span className="v">{snap ? Math.round((snap.R/snap.pop)*100) + '%' : '—'}</span>
                </div>
                <div className="story-stat">
                  <span className="k">R<sub style={{fontSize:9}}>eff</sub></span>
                  <span className="v">{snap ? snap.reff.toFixed(2) : '—'}</span>
                </div>
              </div>
              <div className="story-meta">
                <span className="story-arc">{arc.name}</span>
                <span className="story-count">
                  <b>{String(storyIdx+1).padStart(2,'0')}</b> / {String(arc.chapters.length).padStart(2,'0')}
                </span>
              </div>
              <div className="story-dots">
                {arc.chapters.map((_, i) => (
                  <span key={i}
                    className={"story-dot" + (i === storyIdx ? ' active' : '') + (i < storyIdx ? ' past' : '')}
                    onClick={()=>setStoryIdx(i)}
                  />
                ))}
              </div>
              <div className="story-title">{chapter.title}</div>
              <div className="story-body">{chapter.body}</div>
              <div className="story-foot">
                <button className="btn small ghost" onClick={prevChapter} disabled={storyIdx === 0}>
                  ← Back
                </button>
                <span className="story-spacer"/>
                {storyIdx === arc.chapters.length - 1 ? (
                  <button className="btn small primary" onClick={restartStory}>Restart story</button>
                ) : (
                  <button className="btn small primary" onClick={nextChapter}>
                    Continue →
                  </button>
                )}
              </div>
            </div>
          )}

          {!inStory && (
            <div className="stage-foot">
              <div className="live-tally">
                <div className="tally">
                  <div className="tally-k">Day</div>
                  <div className="tally-v lg">{snap ? Math.floor(snap.day).toString().padStart(2,'0') : '00'}</div>
                </div>
                <div className="tally">
                  <div className="tally-k">Incidence · per day</div>
                  <div className="tally-v accent">{snap ? Math.round(snap.incidence).toLocaleString() : '—'}</div>
                </div>
                <div className="tally">
                  <div className="tally-k">Cumulative cases</div>
                  <div className="tally-v">{snap ? Math.round(snap.cumulative).toLocaleString() : '—'}</div>
                </div>
                <div className="tally">
                  <div className="tally-k">R<sub style={{fontSize:11}}>eff</sub></div>
                  <div className="tally-v">{snap ? snap.reff.toFixed(2) : '—'}</div>
                </div>
              </div>

              <div className="legend">
                <div className="legend-row"><i className="legend-dot" style={{background:'oklch(0.78 0.10 230)'}}/><span>Wildtype</span></div>
                <div className="legend-row"><i className="legend-dot" style={{background:'oklch(0.78 0.10 60)'}}/><span>Alpha · 55% more transmissible</span></div>
                <div className="legend-row"><i className="legend-dot" style={{background:'oklch(0.78 0.10 350)'}}/><span>Beta · 110% more, +severity</span></div>
              </div>
            </div>
          )}

          {inStory && (
            <div className="story-tally-placeholder"/>
          )}
        </div>

        {!started && <StartOverlay onStart={handleStart} onSilent={handleSilent}/>}
      </div>

      {/* ── RAIL ── */}
      <aside className="rail">
        <div className="rail-scroll">

          {/* Transport */}
          <div className="rail-section">
            <div className="rail-section-hd"><h3>Transport</h3>
              <span className="sub">{playing ? 'live' : 'paused'}</span></div>
            <div className="transport">
              <button className="btn primary icon" onClick={togglePlay} title="Play / pause">
                {playing ? Icon.pause : Icon.play}
              </button>
              <div className="clock">
                <b>Day {snap ? Math.floor(snap.day).toString().padStart(3,'0') : '000'}</b>
                <div style={{fontSize:10, color:'var(--fg-faint)', marginTop:2, letterSpacing:'.16em'}}>SEIR · 10 ticks/day</div>
              </div>
              <button className="btn ghost icon" onClick={resetSim} title="Reset">
                {Icon.reset}
              </button>
            </div>
          </div>

          {/* Audio */}
          <div className="rail-section">
            <div className="rail-section-hd"><h3>Sound</h3>
              <span className="sub">{soundOn ? 'on' : 'muted'}</span></div>
            <div className="toggle-row">
              <div>
                <div className="nm">Sonification</div>
                <div className="desc">droplet per audible case</div>
              </div>
              <Switch on={soundOn} onChange={(v)=>{ setSoundOn(v); if (v && !PSAudio.isStarted()) PSAudio.start(); }}/>
            </div>
            <Slider label="Volume" value={volume} min={0} max={1} step={0.01}
              fmt={(v)=> Math.round(v*100) + '%'}
              onChange={setVolume}/>
          </div>

          {/* Parameters */}
          <div className="rail-section">
            <div className="rail-section-hd"><h3>Transmission</h3>
              <span className="sub">edits live</span></div>
            <Slider label="Transmissibility (β)" hint="contacts × per-contact probability per day"
              value={snap?.params.beta ?? 0.34} min={0.05} max={1.0} step={0.005}
              onChange={(v)=>setP('beta', v)}/>
            <Slider label="Infectious duration" hint="1 / γ — days an individual stays infectious"
              value={1/(snap?.params.gamma ?? 1/7)} min={2} max={18} step={0.5}
              fmt={(v)=> v.toFixed(1) + ' d'}
              onChange={(v)=>setP('gamma', 1/v)}/>
            <Slider label="Population immunity" hint="pre-existing immunity or vaccination coverage"
              value={snap?.params.immunity ?? 0.18} min={0} max={0.9} step={0.01}
              fmt={(v)=> Math.round(v*100)+'%'}
              onChange={(v)=>setP('immunity', v)}/>
            <Slider label="Detection rate" hint="probability a case is reported"
              value={snap?.params.detection ?? 0.45} min={0} max={1} step={0.01}
              fmt={(v)=> Math.round(v*100)+'%'}
              onChange={(v)=>setP('detection', v)}/>
            <Slider label="Import pressure" hint="background imported cases per day"
              value={snap?.params.importRate ?? 0} min={0} max={20} step={0.5}
              fmt={(v)=> v.toFixed(1)+' /d'}
              onChange={(v)=>setP('importRate', v)}/>
            <Slider label="Simulation speed" hint="real-time multiplier"
              value={snap?.params.speed ?? 1} min={0.25} max={6} step={0.25}
              fmt={(v)=> v.toFixed(2)+'×'}
              onChange={(v)=>setP('speed', v)}/>
          </div>

          {/* Live metrics */}
          <div className="rail-section">
            <div className="rail-section-hd"><h3>Compartments</h3>
              <span className="sub">N = {snap ? snap.pop.toLocaleString() : '—'}</span></div>
            <div className="metrics">
              <Metric k="Susceptible" v={snap ? Math.round(snap.S).toLocaleString() : '—'} sub={snap ? Math.round((snap.S/snap.pop)*100)+'%' : ''}/>
              <Metric k="Exposed" v={snap ? Math.round(snap.E).toLocaleString() : '—'}/>
              <Metric k="Infectious" v={snap ? Math.round(snap.I).toLocaleString() : '—'} mod="alert"/>
              <Metric k="Recovered / Removed" v={snap ? Math.round(snap.R).toLocaleString() : '—'}/>
            </div>
            <div className="seir">
              {snap && <>
                <span className="seir-S" style={{width: (snap.S/snap.pop*100)+'%'}}/>
                <span className="seir-E" style={{width: (snap.E/snap.pop*100)+'%'}}/>
                <span className="seir-I" style={{width: (snap.I/snap.pop*100)+'%'}}/>
                <span className="seir-R" style={{width: (snap.R/snap.pop*100)+'%'}}/>
              </>}
            </div>
            <div className="seir-legend">
              <span><i style={{background:'oklch(0.4 0.02 250)'}}/>S</span>
              <span><i style={{background:'oklch(0.7 0.10 60)'}}/>E</span>
              <span><i style={{background:'oklch(0.7 0.14 25)'}}/>I</span>
              <span><i style={{background:'oklch(0.55 0.06 160)'}}/>R</span>
            </div>
          </div>

          {/* Discontinuities */}
          <div className="rail-section">
            <div className="rail-section-hd"><h3>Discontinuities</h3>
              <span className="sub">thunder</span></div>
            <div className="events">
              <button className="event-btn" onClick={()=>introVariant('alpha')}>
                <span className="nm"><i style={{background:'oklch(0.78 0.10 60)'}}/>Introduce Alpha</span>
                <span className="meta">×1.55 tx · +5% severity</span>
              </button>
              <button className="event-btn" onClick={()=>introVariant('beta')}>
                <span className="nm"><i style={{background:'oklch(0.78 0.10 350)'}}/>Introduce Beta</span>
                <span className="meta">×2.10 tx · +12% severity</span>
              </button>
              <button className="event-btn" onClick={importPulse} style={{gridColumn:'1 / -1'}}>
                <span className="nm">{Icon.inbox}<span style={{marginLeft:4}}>Import pulse</span></span>
                <span className="meta">+14 seeded infections · short thunder</span>
              </button>
            </div>

            <div className="variants">
              {variants.map(v => (
                <div className="variant-chip" key={v.id}>
                  <span className="nm">
                    <i style={{background:`oklch(0.78 0.10 ${v.hue})`}}/>
                    {v.name}
                  </span>
                  <span className="stats">{(v.share*100).toFixed(1)}% · ×{v.tx.toFixed(2)} tx</span>
                </div>
              ))}
            </div>
          </div>

          {/* Source / data */}
          <div className="rail-section">
            <div className="rail-section-hd"><h3>{mode === 'sim' ? 'Model provenance' : 'Data source'}</h3>
              <span className="sub">{mode === 'sim' ? 'simulated' : 'observed'}</span></div>
            {mode === 'sim' ? (
              <div className="data-source">
                <div className="lbl">Architecture</div>
                <div className="nm">Discrete-time SEIR + clinical sampler</div>
                <div className="src" style={{marginTop:6}}>
                  <span className="tag">Simulated</span>
                  Compartmental ODE, variant-weighted β, exogenous imports. Adapter boundary supports future ingest of real series.
                </div>
              </div>
            ) : (
              <div className="data-source">
                <div className="lbl">{OWID_FIXTURE.geography}</div>
                <div className="nm">{OWID_FIXTURE.pathogen}</div>
                <div className="src" style={{marginTop:6}}>
                  <span className="tag">Observed</span><span className="tag inferred">Inferred clinical</span>
                  <div style={{marginTop:4}}>
                    Source: <a href={OWID_FIXTURE.sourceUrl}>{OWID_FIXTURE.source}</a><br/>
                    Range: {OWID_FIXTURE.dateRange}<br/>
                    License: {OWID_FIXTURE.license}
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </aside>

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Storm treatment"/>
        <TweakRadio label="Drop style" value={t.treatment}
          options={['streak','drops','bokeh']}
          onChange={(v)=>setTweak('treatment', v)}/>
        <TweakToggle label="Show incidence horizon" value={t.horizon}
          onChange={(v)=>setTweak('horizon', v)}/>
        <TweakSection label="Hero"/>
        <TweakToggle label="Show subtitle copy" value={t.showSubtitle}
          onChange={(v)=>setTweak('showSubtitle', v)}/>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
