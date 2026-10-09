// How to perform each exercise, keyed by exercise id. Pure data module, read by
// the technique dialog. "A / B" exercises describe the shared pattern in the main
// sections and the differences under `variants`.
//
// Shape: { muscles, setup, steps, cues, mistakes, variants? } — every field but
// `variants` is a non-empty array of strings.

const t = (muscles, setup, steps, cues, mistakes, variants) => ({
  muscles,
  setup,
  steps,
  cues,
  mistakes,
  ...(variants ? { variants } : {})
});

export const TECHNIQUES = {
  // ---------- push ----------
  'incline-db-press': t(
    ['Upper chest', 'Front delts', 'Triceps'],
    [
      'Set the bench to 30–45°. Lower is more chest, higher is more shoulder.',
      'Sit with the dumbbells on your thighs, then kick them up one knee at a time as you lie back.',
      'Feet flat, shoulder blades pulled back and down, slight arch in the upper back.'
    ],
    [
      'Start with the dumbbells over your upper chest, palms facing forward or slightly in.',
      'Lower under control until the dumbbells are level with your chest and you feel a stretch.',
      'Press up and slightly in, finishing over the upper chest without clanking the bells.'
    ],
    [
      'Elbows about 45–60° from your body, not flared straight out.',
      'Keep the shoulder blades pinned to the bench the whole set.',
      'Two seconds down, controlled press up.'
    ],
    [
      'Bench set too steep — it turns into a shoulder press.',
      'Bouncing out of the bottom instead of controlling the stretch.',
      'Shoulders rolling forward at the top.'
    ]
  ),

  'flat-db-machine-press': t(
    ['Mid chest', 'Front delts', 'Triceps'],
    [
      'Flat bench or machine seat set so the handles line up with mid-chest.',
      'Shoulder blades back and down, feet planted.'
    ],
    [
      'Lower the weight to chest level with control.',
      'Pause briefly in the stretch.',
      'Press back up to just short of lockout.'
    ],
    [
      'Elbows tucked about 45°, forearms vertical.',
      'Drive through the chest, keep the shoulders down.',
      'Same controlled tempo every rep.'
    ],
    [
      'Flaring the elbows to 90°, which stresses the shoulders.',
      'Cutting the range short as the set gets hard.',
      'Lifting the hips off the bench.'
    ],
    [
      { name: 'Flat DB Press', text: 'Free path — let the dumbbells come slightly together at the top. Kick them into position the same way as the incline press.' },
      { name: 'Machine Press', text: 'Fixed path, easier to push close to failure safely. Set the seat so handles start at mid-chest, not at the shoulders.' }
    ]
  ),

  'seated-db-shoulder-press': t(
    ['Front and side delts', 'Triceps', 'Upper chest'],
    [
      'Bench upright at about 80–90°, back fully supported.',
      'Kick the dumbbells up to shoulder height, palms forward or slightly turned in.'
    ],
    [
      'Start with the dumbbells just above shoulder level, elbows slightly in front of the body.',
      'Press up and slightly in until the arms are nearly straight.',
      'Lower under control back to ear or chin level.'
    ],
    [
      'Ribs down, glutes on the seat — don’t turn it into an incline press by arching.',
      'Forearms stay vertical under the weight.',
      'Full range: down to ear level each rep.'
    ],
    [
      'Big lower-back arch.',
      'Half reps from the top only.',
      'Elbows flared straight out to the sides.'
    ]
  ),

  'cable-lateral-raise': t(
    ['Side delts'],
    [
      'Cable set at the lowest position with a single handle.',
      'Stand side-on to the stack, holding the handle in the far hand so the cable crosses in front of your body.',
      'Slight lean away from the machine, holding the frame with the free hand.'
    ],
    [
      'With a slight bend in the elbow, raise the arm out to the side.',
      'Stop around shoulder height.',
      'Lower slowly until the hand is in front of your hip and the cable still has tension.'
    ],
    [
      'Lead with the elbow, not the hand.',
      'Think "out", not "up" — reach for the wall.',
      'Keep the shoulder down, away from the ear.'
    ],
    [
      'Shrugging the weight up with the traps.',
      'Swinging the torso to get the rep.',
      'Going too heavy — this is a 12–20 rep exercise.'
    ]
  ),

  'overhead-triceps-extension': t(
    ['Triceps (especially the long head)'],
    [
      'Cable with a rope at the bottom, facing away from the stack, or a single dumbbell held overhead with both hands.',
      'Staggered stance or seated, core braced.'
    ],
    [
      'Start with the elbows pointing forward/up and the hands behind your head.',
      'Extend the elbows until the arms are straight overhead or in front.',
      'Lower back into a deep stretch behind the head.'
    ],
    [
      'Only the forearms move; upper arms stay still.',
      'Get a full stretch at the bottom — that is the point of this exercise.',
      'Keep the elbows roughly shoulder-width.'
    ],
    [
      'Elbows flaring wide.',
      'Arching the back to move the weight.',
      'Cutting the stretch short.'
    ]
  ),

  'triceps-pushdown': t(
    ['Triceps'],
    [
      'High cable with a straight bar, V-bar or rope.',
      'Stand close, slight forward lean, elbows at your sides.'
    ],
    [
      'Start with the forearms just above parallel.',
      'Push down until the arms are fully straight.',
      'Squeeze for a moment, then return slowly to the start.'
    ],
    [
      'Elbows pinned to your sides.',
      'With a rope, spread the ends apart at the bottom.',
      'Control the way up.'
    ],
    [
      'Elbows drifting forward so the shoulders and lats help.',
      'Leaning over the bar and using bodyweight.',
      'Stopping short of full lockout.'
    ]
  ),

  'machine-chest-press-dips': t(
    ['Lower and mid chest', 'Triceps', 'Front delts'],
    [
      'Machine: seat set so handles are at mid-chest height.',
      'Dips: parallel bars, grip about shoulder-width.'
    ],
    [
      'Lower under control into a stretch across the chest.',
      'Press back up to near lockout.',
      'Keep the reps smooth and even.'
    ],
    [
      'Shoulder blades back and down throughout.',
      'Stop the descent when you feel a good chest stretch, before the shoulders roll forward.',
      'Controlled 2-second lowering.'
    ],
    [
      'Going too deep on dips with shoulder pain.',
      'Bouncing at the bottom.',
      'Shrugging the shoulders up toward the ears.'
    ],
    [
      { name: 'Machine Chest Press', text: 'Easiest to push close to failure. Same set-up rules as the flat machine press.' },
      { name: 'Dips', text: 'Lean the torso forward 20–30° to bias the chest. Lower until the upper arms are about parallel to the floor. Bodyweight only: log reps; with a belt, log the added weight.' }
    ]
  ),

  'db-lateral-raise': t(
    ['Side delts'],
    [
      'Stand tall with a light dumbbell in each hand at your sides, slight forward lean.',
      'Soft bend in the elbows, fixed for the whole set.'
    ],
    [
      'Raise both dumbbells out to the sides.',
      'Stop around shoulder height, pinkies level with or slightly above the thumbs.',
      'Lower slowly, stopping just before the dumbbells touch your thighs.'
    ],
    [
      'Lead with the elbows.',
      'Shoulders down, neck long.',
      'Constant tension — no rest at the bottom.'
    ],
    [
      'Swinging with the hips.',
      'Raising far above shoulder height with the traps.',
      'Too heavy for 15–20 clean reps.'
    ]
  ),

  // ---------- pull ----------
  'pullup-wide-lat-pulldown': t(
    ['Lats', 'Upper back', 'Biceps'],
    [
      'Grip slightly wider than shoulder-width, palms facing away.',
      'Pulldown: thighs locked under the pad, slight lean back.'
    ],
    [
      'Start from a dead hang / arms fully straight, shoulders lifted.',
      'Pull the shoulders down first, then drive the elbows down toward your back pockets.',
      'Bring the chest to the bar (pull-up) or the bar to the upper chest (pulldown).',
      'Return to full stretch under control.'
    ],
    [
      'Elbows down and in, not back.',
      'Chest up, ribs facing the bar.',
      'Full stretch at the top of every rep.'
    ],
    [
      'Kipping or swinging.',
      'Pulling with the arms only and leaving the shoulders shrugged.',
      'Half reps that never straighten the arms.'
    ],
    [
      { name: 'Pull-up', text: 'Use when you can do 6+ clean reps. Log added weight if using a belt, otherwise leave the weight blank.' },
      { name: 'Wide Lat Pulldown', text: 'Use to hit the rep range when pull-ups are too hard or too easy. Avoid leaning back more than about 20°.' }
    ]
  ),

  'chest-supported-row': t(
    ['Mid back (rhomboids, mid traps)', 'Lats', 'Rear delts'],
    [
      'Chest pad of a machine or an incline bench set at about 30–45°.',
      'Chest stays on the pad for the whole set.'
    ],
    [
      'Start with the arms fully stretched forward/down.',
      'Pull the elbows back past your torso, squeezing the shoulder blades together.',
      'Lower slowly back to a full stretch.'
    ],
    [
      'Drive with the elbows, not the hands.',
      'Pause briefly at the top.',
      'Let the shoulder blades travel forward at the bottom.'
    ],
    [
      'Lifting the chest off the pad to cheat the weight up.',
      'Shrugging instead of pulling back.',
      'Short range at the bottom.'
    ]
  ),

  'seated-cable-row-wide': t(
    ['Upper back', 'Rear delts', 'Lats'],
    [
      'Seated cable row with a wide bar or wide handle attachment.',
      'Feet on the platform, knees slightly bent, torso upright.'
    ],
    [
      'Start with the arms straight and the shoulder blades reaching forward.',
      'Pull the bar to the lower chest, elbows flaring to about 45–60°.',
      'Return slowly, letting the shoulder blades open.'
    ],
    [
      'Torso stays still — only a little lean.',
      'Squeeze the shoulder blades together at the end of each rep.',
      'Wide elbows hit the upper back.'
    ],
    [
      'Rocking back and forth with the lower back.',
      'Pulling to the belly with tucked elbows (that is a different exercise).',
      'Rushing the eccentric.'
    ]
  ),

  'face-pull': t(
    ['Rear delts', 'Rotator cuff', 'Mid traps'],
    [
      'Cable at about face height with a rope.',
      'Hold the rope with palms facing down or in, step back until the arms are straight.'
    ],
    [
      'Pull the rope toward your face, separating the ends.',
      'Finish with the hands beside the ears and the elbows high, like a double-biceps pose.',
      'Return slowly.'
    ],
    [
      'Elbows at or above shoulder height.',
      'Pull apart, not just back.',
      'Light weight, strict reps.'
    ],
    [
      'Going heavy and leaning back.',
      'Elbows dropping so it becomes a row.',
      'No external rotation at the end.'
    ]
  ),

  'rear-delt-fly': t(
    ['Rear delts', 'Mid traps'],
    [
      'Reverse pec-deck (facing the pad), cables crossed, or dumbbells bent over.',
      'Slight bend in the elbows, fixed throughout.'
    ],
    [
      'Start with the arms in front of you.',
      'Sweep the arms out and back in a wide arc.',
      'Stop when the arms are in line with the body, then return slowly.'
    ],
    [
      'Think "push the hands out wide" rather than "squeeze the shoulder blades".',
      'Lead with the pinkies.',
      'Keep the shoulders down.'
    ],
    [
      'Shrugging.',
      'Bending the elbows more during the rep, which turns it into a row.',
      'Swinging the torso.'
    ]
  ),

  'db-cable-curl': t(
    ['Biceps', 'Brachialis'],
    [
      'Stand tall, elbows at your sides, palms facing forward.',
      'Dumbbells at your sides or a cable bar/handle from the low pulley.'
    ],
    [
      'Curl the weight up, keeping the elbows in place.',
      'Squeeze at the top.',
      'Lower slowly until the arms are fully straight.'
    ],
    [
      'Elbows stay at your sides.',
      'Full stretch at the bottom of each rep.',
      'No swinging.'
    ],
    [
      'Using the hips to swing the weight.',
      'Elbows drifting forward at the top.',
      'Half reps.'
    ],
    [
      { name: 'DB Curl', text: 'Turn the palms up (supinate) as you curl. Alternate arms or curl both together.' },
      { name: 'Cable Curl', text: 'Constant tension at the bottom. Stand a short step back from the pulley so the cable pulls slightly forward.' }
    ]
  ),

  'barbell-chest-supported-row': t(
    ['Mid back', 'Lats', 'Rear delts', 'Spinal erectors (barbell)'],
    [
      'Choose barbell row or chest-supported row; log whichever you did.'
    ],
    [
      'Start with the arms fully straight.',
      'Row the weight toward the lower ribs, driving the elbows back.',
      'Lower under control to full stretch.'
    ],
    [
      'Elbows about 45° from the body.',
      'Squeeze the shoulder blades at the top.',
      'Same torso angle every rep.'
    ],
    [
      'Using momentum from the hips.',
      'Rounding the lower back.',
      'Short range at the bottom.'
    ],
    [
      { name: 'Barbell Row', text: 'Overhand grip just outside the knees. Hinge until the torso is 30–45° above horizontal, back flat, knees soft. Pull to the lower ribs. Keep the torso still — if it rises, the weight is too heavy.' },
      { name: 'Chest-Supported Row', text: 'Same as Pull A’s chest-supported row, but heavier and in the 6–10 rep range.' }
    ]
  ),

  'lat-pulldown-neutral': t(
    ['Lats', 'Biceps', 'Lower traps'],
    [
      'Lat pulldown with a close neutral (palms-facing) handle.',
      'Thighs locked under the pad.'
    ],
    [
      'Start with the arms straight and the shoulders lifted.',
      'Pull the shoulders down, then the elbows down to your sides.',
      'Bring the handle to the upper chest, then return to a full stretch.'
    ],
    [
      'Elbows travel down and slightly back, close to the body.',
      'Lean back only slightly.',
      'Feel the stretch in the lats at the top.'
    ],
    [
      'Leaning far back so it becomes a row.',
      'Pulling the handle down to the belly.',
      'Letting the weight yank the arms up.'
    ]
  ),

  'single-arm-db-row': t(
    ['Lats', 'Mid back'],
    [
      'One hand and same-side knee on a flat bench, other foot on the floor.',
      'Back flat, roughly parallel to the floor; dumbbell hanging under the shoulder.'
    ],
    [
      'Pull the dumbbell toward the hip in a slight arc.',
      'Squeeze at the top with the elbow past the torso.',
      'Lower to a full stretch. Do all reps on one side, then the other.'
    ],
    [
      'Pull to the hip, not the chest.',
      'Keep the shoulders square to the floor.',
      'Log the reps for one side.'
    ],
    [
      'Twisting the torso to heave the weight.',
      'Shrugging the shoulder up.',
      'Rounding the back.'
    ]
  ),

  'incline-db-curl': t(
    ['Biceps (long head)'],
    [
      'Bench at about 45–60°, sitting back with the arms hanging straight down behind the body line.',
      'Palms forward.'
    ],
    [
      'Curl both dumbbells up without moving the upper arms.',
      'Squeeze at the top.',
      'Lower slowly to a full stretch.'
    ],
    [
      'Upper arms stay pointing down.',
      'The stretch at the bottom is the point — don’t cut it.',
      'Lighter than your standing curls.'
    ],
    [
      'Shoulders rolling forward off the bench.',
      'Elbows swinging forward.',
      'Going too heavy.'
    ]
  ),

  'hammer-curl': t(
    ['Brachialis', 'Brachioradialis (forearm)', 'Biceps'],
    [
      'Stand tall with dumbbells at your sides, palms facing your body.'
    ],
    [
      'Curl the dumbbells up, palms still facing in.',
      'Squeeze at the top.',
      'Lower slowly to fully straight arms.'
    ],
    [
      'Thumbs up throughout.',
      'Elbows by your sides.',
      'Can be done across the body toward the opposite shoulder.'
    ],
    [
      'Swinging.',
      'Elbows drifting forward.',
      'Cutting the bottom of the rep.'
    ]
  ),

  // ---------- legs ----------
  'back-squat': t(
    ['Quads', 'Glutes', 'Adductors', 'Core'],
    [
      'Bar on the upper traps (high bar), hands just outside the shoulders.',
      'Walk out with two or three steps. Feet about shoulder-width, toes turned out 15–30°.',
      'Big breath into the belly and brace before each rep.'
    ],
    [
      'Break at the hips and knees at the same time and sit down between your heels.',
      'Descend until the hip crease is at or below the top of the knee, as deep as you can keep a neutral back.',
      'Drive up through the whole foot, chest and hips rising together.',
      'Breathe out at the top, re-brace, next rep.'
    ],
    [
      'Knees track over the toes.',
      'Whole foot planted — big toe, little toe, heel.',
      'Chest up, eyes forward.',
      'Use safety bars set just below the bottom position.'
    ],
    [
      'Knees caving in on the way up.',
      'Hips shooting up first (good-morning squat).',
      'Heels lifting.',
      'Losing the brace and rounding at the bottom.'
    ]
  ),

  'leg-press': t(
    ['Quads', 'Glutes'],
    [
      'Back and hips flat against the pad.',
      'Feet shoulder-width in the middle of the platform.'
    ],
    [
      'Release the safeties and lower the sled under control.',
      'Go as deep as you can without the lower back peeling off the pad.',
      'Press back up through the whole foot to just short of lockout.'
    ],
    [
      'Knees track over the toes.',
      'Hips stay down on the seat.',
      'Controlled 2–3 seconds down.'
    ],
    [
      'Lower back rounding off the pad at the bottom.',
      'Locking the knees hard at the top.',
      'Tiny range with heavy weight.'
    ]
  ),

  'bulgarian-split-squat': t(
    ['Quads', 'Glutes', 'Adductors'],
    [
      'Back foot laces-down on a bench behind you.',
      'Front foot far enough forward that the front knee can bend without the heel lifting.',
      'Dumbbells at your sides, or bodyweight to start.'
    ],
    [
      'Lower straight down until the back knee is close to the floor.',
      'Drive up through the front foot.',
      'Do all reps on one leg, then switch.'
    ],
    [
      'Most of the weight on the front leg.',
      'Slight forward lean is fine; more lean = more glutes.',
      'Log the reps for one leg.'
    ],
    [
      'Pushing off with the back leg.',
      'Front heel lifting.',
      'Front knee caving in.'
    ]
  ),

  'leg-extension': t(
    ['Quads'],
    [
      'Knee joint lined up with the machine’s pivot.',
      'Ankle pad just above the feet; hold the handles.'
    ],
    [
      'Extend the legs until fully straight.',
      'Squeeze the quads for a second at the top.',
      'Lower slowly to about 90° or a little further.'
    ],
    [
      'Hips stay down in the seat.',
      'Pause at the top every rep.',
      'Slow eccentric.'
    ],
    [
      'Kicking the weight up and letting it drop.',
      'Hips lifting off the seat.',
      'Partial reps.'
    ]
  ),

  'standing-calf-raise': t(
    ['Calves (gastrocnemius)'],
    [
      'Calf machine or a step, balls of the feet on the edge, knees straight.'
    ],
    [
      'Lower the heels into a deep stretch and pause for 1–2 seconds.',
      'Rise as high as you can onto the big toe.',
      'Pause at the top, then lower slowly.'
    ],
    [
      'Knees straight but not locked.',
      'Pause at the bottom — no bouncing.',
      'Full range beats heavy weight.'
    ],
    [
      'Bouncing out of the bottom.',
      'Bending the knees to help.',
      'Tiny half reps.'
    ]
  ),

  'hanging-leg-raise': t(
    ['Lower abs', 'Hip flexors'],
    [
      'Hang from a pull-up bar with a shoulder-width grip, shoulders active (not fully relaxed).'
    ],
    [
      'Curl the pelvis up as you raise the legs, knees bent or straight.',
      'Bring the knees toward the chest or the legs to at least parallel.',
      'Lower slowly without swinging.'
    ],
    [
      'Tilt the pelvis up — the curl matters more than the leg height.',
      'Stay still between reps.',
      'Bodyweight: log reps only.'
    ],
    [
      'Swinging for momentum.',
      'Only lifting the legs without curling the pelvis.',
      'Dropping the legs fast.'
    ]
  ),

  'romanian-trap-bar-deadlift': t(
    ['Hamstrings', 'Glutes', 'Spinal erectors'],
    [
      'Choose Romanian deadlift or trap-bar deadlift; log whichever you did.',
      'Brace hard before every rep.'
    ],
    [
      'Keep the bar or handles close to your legs throughout.',
      'Keep the back flat from start to finish.',
      'Stand tall at the top, squeezing the glutes, without leaning back.'
    ],
    [
      'Neutral spine — chest up, lats tight.',
      'Push the floor away / push the hips back.',
      'Control the weight down.'
    ],
    [
      'Rounding the lower back.',
      'Bar drifting away from the legs.',
      'Hyperextending at the top.'
    ],
    [
      { name: 'Romanian Deadlift', text: 'Start standing. Soft knees, push the hips back, slide the bar down the thighs until you feel a strong hamstring stretch (usually mid-shin). Drive the hips forward to stand. It is a hinge, not a squat.' },
      { name: 'Trap-Bar Deadlift', text: 'Stand in the centre of the bar, grip the handles, hips lower than for a conventional deadlift. Push the floor away and stand up tall. Lower under control to the floor.' }
    ]
  ),

  'lying-leg-curl': t(
    ['Hamstrings'],
    [
      'Lie face down, knees just off the end of the pad, lined up with the pivot.',
      'Ankle pad just above the heels; hold the handles.'
    ],
    [
      'Curl the heels toward the glutes.',
      'Squeeze at the top.',
      'Lower slowly to almost straight legs.'
    ],
    [
      'Hips pressed into the pad.',
      'Point the toes slightly toward the shins (dorsiflex).',
      'Slow on the way down.'
    ],
    [
      'Hips lifting off the pad.',
      'Jerking the weight up.',
      'Not fully straightening the legs.'
    ]
  ),

  'hip-thrust-back-extension': t(
    ['Glutes', 'Hamstrings', 'Spinal erectors (back extension)'],
    [
      'Choose hip thrust or back extension; log whichever you did.'
    ],
    [
      'Move through the hips; the spine stays neutral.',
      'Squeeze the glutes hard at the top of every rep.',
      'Lower under control.'
    ],
    [
      'Hips drive the movement.',
      'Hold the top for a second.',
      'Chin tucked, ribs down.'
    ],
    [
      'Arching the lower back to finish the rep.',
      'Rushing the reps.',
      'Not reaching full hip extension.'
    ],
    [
      { name: 'Hip Thrust', text: 'Upper back on a bench edge, bar over the hips with a pad. Feet flat, about shoulder-width, so the shins are vertical at the top. Drive the hips up until the body is flat from shoulders to knees, squeeze, then lower.' },
      { name: 'Back Extension', text: '45° bench, pad just below the hip bones. Round slightly forward at the bottom, then drive the hips into the pad and rise until the body is straight. Hold a plate to the chest for added weight.' }
    ]
  ),

  'leg-press-feet-high': t(
    ['Glutes', 'Hamstrings', 'Quads'],
    [
      'Back and hips flat on the pad.',
      'Feet high on the platform, shoulder-width or slightly wider.'
    ],
    [
      'Lower the sled under control as deep as you can with the hips staying down.',
      'Press through the heels to just short of lockout.'
    ],
    [
      'Push through the heels.',
      'Knees track over the toes.',
      'Keep the lower back on the pad.'
    ],
    [
      'Hips rolling up off the seat at the bottom.',
      'Heels lifting.',
      'Locking the knees.'
    ]
  ),

  'seated-calf-raise': t(
    ['Calves (soleus)'],
    [
      'Seated calf machine, pad on the lower thighs, balls of the feet on the platform.'
    ],
    [
      'Release the safety and lower the heels into a deep stretch.',
      'Pause, then rise as high as you can.',
      'Pause at the top, then lower slowly.'
    ],
    [
      'Bent knees target the soleus.',
      'Pause at both ends.',
      'Steady tempo, no bouncing.'
    ],
    [
      'Bouncing in the bottom.',
      'Short range.',
      'Rushing through reps.'
    ]
  ),

  'cable-crunch': t(
    ['Abs (rectus abdominis)'],
    [
      'High cable with a rope. Kneel facing the stack.',
      'Hold the rope beside your head; hips stay high.'
    ],
    [
      'Crunch down by curling the ribs toward the pelvis.',
      'Bring the elbows toward the knees.',
      'Return slowly until the abs are stretched.'
    ],
    [
      'Round the spine — the movement is a curl, not a hip hinge.',
      'Hips stay still.',
      'Breathe out hard at the bottom.'
    ],
    [
      'Sitting back onto the heels and pulling with the arms.',
      'Hinging at the hips instead of curling the spine.',
      'Too heavy to control.'
    ]
  )
};

export function techniqueFor(exerciseId) {
  return TECHNIQUES[exerciseId] || null;
}

// Opens YouTube results in the browser; online only, never fetched by the app.
export function videoSearchUrl(exerciseName) {
  const query = `${exerciseName} exercise technique`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}
