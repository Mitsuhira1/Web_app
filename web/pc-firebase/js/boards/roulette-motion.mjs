// Angles are clockwise from twelve o'clock. Radii use the wheel illustration's units.
const wrap = angle => (angle % 360 + 360) % 360;
const mix = (from, to, t) => from + (to - from) * t;

export function restingPose(round, slots) {
  if (!round) return { rotor: 0, orbit: 320 };
  // A player rejoining a settled table sees the same bearing as the original spin.
  const orbit = wrap(137.508 * round.roundNo + 23.73 * round.pocketIdx);
  return { rotor: wrap(orbit - round.pocketIdx * 360 / slots), orbit };
}

export function makeRouletteSpin(from, round, slots) {
  const step = 360 / slots;
  const direction = round.roundNo % 2 ? 1 : -1;
  const variation = ((round.pocketIdx * 31 + round.roundNo * 17) % 59) / 58;
  const duration = 5100 + 420 * variation;
  const end = restingPose(round, slots);
  const travel = direction * (720 + wrap(direction * (end.rotor - from)));
  function rotorAt(t) {
    const release = .045;
    const fraction = t < release ? t * t / release : 1 - (1 - t) ** 2 / (1 - release);
    return from + travel * fraction;
  }
  const pocketAt = t => rotorAt(t) + round.pocketIdx * step;

  const diamondTime = .52 + .025 * variation;
  const firstFret = .674 + .014 * variation;
  const skip = variation > .52 ? 4.5 : 3.5;
  const firstEdge = pocketAt(firstFret) + direction * skip * step;
  // Align the first strike with one of the eight fixed deflectors on the bowl.
  const diamond = direction * 45 * Math.ceil((direction * firstEdge + 58) / 45);

  const launchDistance = 1080 + wrap(direction * (320 - diamond));

  // Radial/tangential contacts in the moving wheel's frame. Between contacts the
  // height follows a ballistic arc. Later rebounds stay within one pocket.
  const contacts = [
    {t: diamondTime, angle: diamond, radius: 165, jump: 6.6, kind: 'deflector', strength: .88},
    {t: firstFret, edge: skip, radius: 128.5, jump: 5.1, kind: 'fret', strength: .79},
    {t: .737, edge: 1.5, radius: 119, jump: 3.6, kind: 'fret', strength: .60},
    {t: .785, edge: .5, radius: 123, jump: 2.2, kind: 'fret', strength: .43},
    {t: .83, edge: -.5, radius: 117.8, jump: 1.3, kind: 'fret', strength: .32},
    {t: .872, edge: .30, radius: 121.9, jump: .55, kind: 'settle', strength: .22},
    {t: .907, edge: -.13, radius: 120.6, jump: .22, kind: 'settle', strength: .13},
    {t: .945, edge: 0, radius: 121, jump: 0, kind: 'settle', strength: .07},
  ];
  // Start the transition to the rotating frame at the *actual* point of impact.
  const offsets = contacts.map(hit => hit.angle != null
    ? hit.angle - pocketAt(hit.t)
    : direction * hit.edge * step);

  function poseAt(progress) {
    const t = Math.max(0, Math.min(1, progress));
    const rotor = rotorAt(t);
    if (t < diamondTime) {
      const remaining = 1 - t / diamondTime;
      const orbit = diamond + direction * (374 * remaining + (launchDistance - 374) * remaining ** 2);
      const descent = Math.max(0, (t - .32) / (diamondTime - .32));
      const radius = 179.5 - 14.5 * descent ** 2;
      return { rotor, orbit, radius, height: 0 };
    }
    const next = contacts.findIndex(hit => hit.t > t);
    if (next < 0) return { rotor, orbit: pocketAt(t), radius: 121, height: 0 };
    const hit = contacts[next - 1], target = contacts[next];
    const u = (t - hit.t) / (target.t - hit.t);
    const arc = 4 * u * (1 - u);
    // The deflector sends the ball down the slope; the narrow metal frets
    // redirect it sideways. Tangential speed loses energy after each strike.
    const offset = mix(offsets[next - 1], offsets[next], u * (1.18 - .18 * u));
    return {
      rotor, orbit: pocketAt(t) + offset,
      radius: mix(hit.radius, target.radius, u) + (next === 1 ? 3.8 : .8) * arc,
      height: hit.jump * arc,
    };
  }

  function panAt(t) { return Math.sin(poseAt(t).orbit * Math.PI / 180); }
  const impacts = contacts.map(hit => ({
    at: hit.t * duration, kind: hit.kind, strength: hit.strength, pan: panAt(hit.t),
  }));
  return { duration, poseAt, impacts, panAt };
}
