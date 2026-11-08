/*
  Built-in exercise library, limited to the equipment at Eyron's gym:
  dumbbells, cable machine, bench press, lat pulldown, leg press,
  hack squat machine, leg extension, barbells, T-bar row.

  RULES
  - Never rename an exercise once it has been logged: history is matched by name.
  - Every id in `alts` must exist in this list.
  - cat must be one of: Legs, Chest, Back, Shoulders, Arms, Core.
*/
window.EXERCISES = [
  // ---------------- Legs ----------------
  {
    id: 'hack-squat', name: 'Hack Squat', cat: 'Legs', equip: 'Hack squat machine',
    cues: [
      'Feet shoulder-width apart in the middle of the platform.',
      'Lower until your thighs are about parallel to the floor, or as deep as you can while your lower back stays on the pad.',
      'Push through your whole foot and stop just short of locking your knees.',
    ],
    alts: ['leg-press', 'goblet-squat', 'bulgarian-split-squat'],
  },
  {
    id: 'leg-press', name: 'Leg Press', cat: 'Legs', equip: 'Leg press machine',
    cues: [
      'Keep your lower back and hips flat on the pad the whole time.',
      'Lower until your knees reach about 90 degrees, or deeper if your hips stay down.',
      "Press through your heels and midfoot. Don't slam your knees straight.",
    ],
    alts: ['hack-squat', 'goblet-squat', 'bulgarian-split-squat'],
  },
  {
    id: 'goblet-squat', name: 'Dumbbell Goblet Squat', cat: 'Legs', equip: 'Dumbbell',
    cues: [
      'Hold one dumbbell upright against your chest.',
      'Sit down between your hips with your chest up.',
      'Let your knees travel in the same direction as your toes.',
    ],
    alts: ['hack-squat', 'leg-press', 'bulgarian-split-squat'],
  },
  {
    id: 'bulgarian-split-squat', name: 'Dumbbell Bulgarian Split Squat', cat: 'Legs', equip: 'Dumbbells and a bench',
    cues: [
      'Rest the top of your back foot on the bench.',
      'Put the front foot far enough forward that its heel stays down at the bottom.',
      'Drop straight down until your back knee nearly touches the floor.',
    ],
    alts: ['dumbbell-lunge', 'goblet-squat', 'leg-press'],
  },
  {
    id: 'dumbbell-lunge', name: 'Dumbbell Lunge', cat: 'Legs', equip: 'Dumbbells',
    cues: [
      'Take a long step and lower until both knees bend to about 90 degrees.',
      'Keep your torso upright and your front heel planted.',
      'Push back up through the front foot.',
    ],
    alts: ['bulgarian-split-squat', 'goblet-squat', 'leg-press'],
  },
  {
    id: 'leg-extension', name: 'Leg Extension', cat: 'Legs', equip: 'Leg extension machine',
    cues: [
      "Line your knee up with the machine's pivot point.",
      'Straighten your legs fully and squeeze for a second at the top.',
      "Lower slowly. Don't let the weight stack slam.",
    ],
    alts: ['goblet-squat', 'bulgarian-split-squat', 'leg-press'],
  },
  {
    id: 'barbell-rdl', name: 'Barbell Romanian Deadlift', cat: 'Legs', equip: 'Barbell',
    cues: [
      'Bend your knees slightly, then push your hips back as the bar slides down your thighs.',
      'Keep your back flat and the bar touching or close to your legs.',
      'Stop when your hamstrings are stretched hard, then drive your hips forward.',
    ],
    alts: ['dumbbell-rdl', 'cable-pull-through', 'barbell-hip-thrust'],
  },
  {
    id: 'dumbbell-rdl', name: 'Dumbbell Romanian Deadlift', cat: 'Legs', equip: 'Dumbbells',
    cues: [
      'Dumbbells in front of your thighs, knees slightly bent.',
      'Push your hips back with a flat back until your hamstrings are stretched.',
      'Stand up by driving your hips forward and squeezing your glutes.',
    ],
    alts: ['barbell-rdl', 'cable-pull-through', 'barbell-hip-thrust'],
  },
  {
    id: 'cable-pull-through', name: 'Cable Pull-Through', cat: 'Legs', equip: 'Cable machine, low pulley with rope',
    cues: [
      'Face away from the stack with the rope between your legs.',
      'Hinge at the hips with a flat back until you feel your hamstrings stretch.',
      'Stand up by squeezing your glutes, not by leaning back.',
    ],
    alts: ['barbell-rdl', 'dumbbell-rdl', 'barbell-hip-thrust'],
  },
  {
    id: 'barbell-hip-thrust', name: 'Barbell Hip Thrust', cat: 'Legs', equip: 'Barbell and a bench',
    cues: [
      'Upper back on the edge of the bench, bar over your hips with a pad.',
      'Drive your hips up until your body is straight from knees to shoulders.',
      'Keep your chin tucked and pause at the top.',
    ],
    alts: ['cable-pull-through', 'barbell-rdl', 'dumbbell-rdl'],
  },
  {
    id: 'dumbbell-calf-raise', name: 'Standing Dumbbell Calf Raise', cat: 'Legs', equip: 'Dumbbell and a step or plate',
    cues: [
      'Stand with the balls of your feet on a step or plate.',
      'Lower until your calves are fully stretched and pause.',
      'Rise as high as you can and squeeze.',
    ],
    alts: ['leg-press-calf-raise'],
  },
  {
    id: 'leg-press-calf-raise', name: 'Leg Press Calf Raise', cat: 'Legs', equip: 'Leg press machine',
    cues: [
      'Balls of your feet on the bottom edge of the platform, knees straight but not locked.',
      'Let the platform push your toes back to a full stretch.',
      'Press with your toes as far as you can.',
    ],
    alts: ['dumbbell-calf-raise'],
  },

  // ---------------- Chest ----------------
  {
    id: 'barbell-bench-press', name: 'Barbell Bench Press', cat: 'Chest', equip: 'Barbell and bench press',
    cues: [
      'Pull your shoulder blades back and down, feet flat on the floor.',
      'Lower the bar to your mid-chest with your elbows angled 45 to 70 degrees from your body.',
      'Press up and slightly back. Use a spotter or safety bars when going heavy.',
    ],
    alts: ['dumbbell-bench-press', 'incline-dumbbell-press', 'push-up'],
  },
  {
    id: 'dumbbell-bench-press', name: 'Dumbbell Bench Press', cat: 'Chest', equip: 'Dumbbells and a bench',
    cues: [
      'Kick the dumbbells up off your thighs as you lie back.',
      'Lower until your elbows are just below the bench, forearms vertical.',
      'Press up and slightly inward without banging the dumbbells together.',
    ],
    alts: ['barbell-bench-press', 'incline-dumbbell-press', 'push-up'],
  },
  {
    id: 'incline-dumbbell-press', name: 'Incline Dumbbell Press', cat: 'Chest', equip: 'Dumbbells and an incline bench',
    cues: [
      'Set the bench to about 30 degrees.',
      'Lower the dumbbells to your upper chest with elbows slightly tucked.',
      'Press up without your lower back lifting off the bench.',
    ],
    alts: ['dumbbell-bench-press', 'barbell-bench-press', 'cable-fly'],
  },
  {
    id: 'dumbbell-fly', name: 'Dumbbell Fly', cat: 'Chest', equip: 'Dumbbells and a bench',
    cues: [
      'Keep a slight bend in your elbows and hold it the whole set.',
      'Open your arms until you feel a chest stretch, no deeper.',
      'Bring the dumbbells back up in a hugging arc.',
    ],
    alts: ['cable-fly', 'dumbbell-bench-press'],
  },
  {
    id: 'cable-fly', name: 'Cable Fly', cat: 'Chest', equip: 'Cable machine with two pulleys',
    cues: [
      'Stand between the pulleys in a split stance, leaning forward slightly.',
      'Keep a soft, fixed bend in your elbows.',
      'Bring your hands together in front of your chest and squeeze.',
    ],
    alts: ['dumbbell-fly', 'incline-dumbbell-press'],
  },
  {
    id: 'push-up', name: 'Push-Up', cat: 'Chest', equip: 'Bodyweight',
    cues: [
      'Hands slightly wider than your shoulders, body in one straight line.',
      "Lower until your chest is about a fist's height from the floor.",
      'Leave the weight box empty to log bodyweight reps.',
    ],
    alts: ['dumbbell-bench-press', 'barbell-bench-press'],
  },

  // ---------------- Back ----------------
  {
    id: 'lat-pulldown', name: 'Lat Pulldown', cat: 'Back', equip: 'Lat pulldown machine',
    cues: [
      'Grip just outside shoulder width with your thighs locked under the pad.',
      'Pull the bar to your upper chest, driving your elbows down and back.',
      'Let the bar rise slowly until your arms are straight.',
    ],
    alts: ['close-grip-pulldown', 'straight-arm-pulldown', 'dumbbell-pullover'],
  },
  {
    id: 'close-grip-pulldown', name: 'Close-Grip Lat Pulldown', cat: 'Back', equip: 'Lat pulldown machine with V-handle',
    cues: [
      'Use the V-handle with your palms facing each other.',
      'Lean back slightly and pull the handle to your lower chest.',
      'Control it back up to a full stretch.',
    ],
    alts: ['lat-pulldown', 'straight-arm-pulldown', 'dumbbell-pullover'],
  },
  {
    id: 't-bar-row', name: 'T-Bar Row', cat: 'Back', equip: 'T-bar row',
    cues: [
      'Hinge to about 45 degrees with a flat back and soft knees.',
      'Pull the handle to your lower chest and squeeze your shoulder blades together.',
      "Lower under control. Don't let your back round at the bottom.",
    ],
    alts: ['barbell-row', 'one-arm-dumbbell-row', 'seated-cable-row'],
  },
  {
    id: 'barbell-row', name: 'Barbell Bent-Over Row', cat: 'Back', equip: 'Barbell',
    cues: [
      'Hinge until your torso is at 45 degrees or lower, back flat.',
      'Pull the bar to your lower ribs with your elbows close to your body.',
      'Lower to straight arms without jerking your torso up.',
    ],
    alts: ['t-bar-row', 'one-arm-dumbbell-row', 'seated-cable-row'],
  },
  {
    id: 'one-arm-dumbbell-row', name: 'One-Arm Dumbbell Row', cat: 'Back', equip: 'Dumbbell and a bench',
    cues: [
      'One hand and knee on the bench, back flat and level.',
      'Pull the dumbbell toward your hip, not your shoulder.',
      'Let it hang to a full stretch at the bottom.',
    ],
    alts: ['t-bar-row', 'barbell-row', 'seated-cable-row'],
  },
  {
    id: 'seated-cable-row', name: 'Seated Cable Row', cat: 'Back', equip: 'Cable machine, low pulley',
    cues: [
      "Sit tall with a slight knee bend. Don't round your lower back.",
      'Pull the handle to your stomach, chest up, elbows close.',
      'Let your shoulder blades slide forward on the way back for a full stretch.',
    ],
    alts: ['t-bar-row', 'one-arm-dumbbell-row', 'barbell-row'],
  },
  {
    id: 'straight-arm-pulldown', name: 'Cable Straight-Arm Pulldown', cat: 'Back', equip: 'Cable machine, high pulley',
    cues: [
      'Arms nearly straight, leaning forward slightly.',
      'Sweep the bar down to your thighs using your lats.',
      'Return slowly until your arms are overhead.',
    ],
    alts: ['dumbbell-pullover', 'lat-pulldown'],
  },
  {
    id: 'dumbbell-pullover', name: 'Dumbbell Pullover', cat: 'Back', equip: 'Dumbbell and a bench',
    cues: [
      'Lie on the bench holding one dumbbell over your chest with both hands.',
      'Lower it behind your head with slightly bent elbows until you feel a stretch.',
      'Pull it back over your chest.',
    ],
    alts: ['straight-arm-pulldown', 'lat-pulldown'],
  },
  {
    id: 'barbell-deadlift', name: 'Barbell Deadlift', cat: 'Back', equip: 'Barbell',
    cues: [
      'Bar over your midfoot, shins close to the bar.',
      'Flat back, chest up, and pull the slack out of the bar before lifting.',
      "Push the floor away and finish standing tall. Don't lean back.",
    ],
    alts: ['barbell-rdl', 'dumbbell-rdl'],
  },
  {
    id: 'dumbbell-shrug', name: 'Dumbbell Shrug', cat: 'Back', equip: 'Dumbbells',
    cues: [
      'Stand tall with the dumbbells at your sides.',
      "Lift your shoulders straight up toward your ears. Don't roll them.",
      'Pause at the top and lower slowly.',
    ],
    alts: [],
  },

  // ---------------- Shoulders ----------------
  {
    id: 'dumbbell-shoulder-press', name: 'Dumbbell Shoulder Press', cat: 'Shoulders', equip: 'Dumbbells and an upright bench',
    cues: [
      'Sit on an upright bench with the dumbbells at ear level.',
      'Press up until your arms are straight without arching your lower back.',
      'Lower back to ear level with your elbows slightly in front of your body.',
    ],
    alts: ['barbell-overhead-press', 'arnold-press'],
  },
  {
    id: 'barbell-overhead-press', name: 'Barbell Overhead Press', cat: 'Shoulders', equip: 'Barbell',
    cues: [
      'Bar on the front of your shoulders, grip just outside them.',
      "Squeeze your glutes and press straight up, moving your head back out of the bar's path.",
      'Finish with the bar over your midfoot and your head through.',
    ],
    alts: ['dumbbell-shoulder-press', 'arnold-press'],
  },
  {
    id: 'arnold-press', name: 'Dumbbell Arnold Press', cat: 'Shoulders', equip: 'Dumbbells and an upright bench',
    cues: [
      'Start with your palms facing you at chin height.',
      'Rotate your palms forward as you press up.',
      'Reverse the rotation on the way down.',
    ],
    alts: ['dumbbell-shoulder-press', 'barbell-overhead-press'],
  },
  {
    id: 'dumbbell-lateral-raise', name: 'Dumbbell Lateral Raise', cat: 'Shoulders', equip: 'Dumbbells',
    cues: [
      'Slight bend in your elbows, leaning forward a little.',
      'Raise to shoulder height, leading with your elbows.',
      'Lower slowly. If you have to swing, the weight is too heavy.',
    ],
    alts: ['cable-lateral-raise'],
  },
  {
    id: 'cable-lateral-raise', name: 'Cable Lateral Raise', cat: 'Shoulders', equip: 'Cable machine, low pulley',
    cues: [
      'Stand side-on to the stack, handle in your far hand, cable across your body.',
      'Raise to shoulder height, leading with your elbow.',
      'Lower slowly to keep tension on your shoulder.',
    ],
    alts: ['dumbbell-lateral-raise'],
  },
  {
    id: 'rear-delt-fly', name: 'Dumbbell Rear Delt Fly', cat: 'Shoulders', equip: 'Dumbbells',
    cues: [
      'Hinge forward until your chest is almost parallel to the floor.',
      'Raise the dumbbells out to the sides with soft elbows.',
      "Squeeze the backs of your shoulders. Don't shrug.",
    ],
    alts: ['face-pull'],
  },
  {
    id: 'face-pull', name: 'Cable Face Pull', cat: 'Shoulders', equip: 'Cable machine, high pulley with rope',
    cues: [
      'Set the rope at face height and step back until your arms are straight.',
      'Pull the rope toward your forehead, splitting the ends apart.',
      'Finish with your elbows high and hands beside your ears.',
    ],
    alts: ['rear-delt-fly'],
  },

  // ---------------- Arms ----------------
  {
    id: 'barbell-curl', name: 'Barbell Curl', cat: 'Arms', equip: 'Barbell',
    cues: [
      'Keep your elbows pinned at your sides.',
      'Curl without swinging your hips or leaning back.',
      'Lower all the way until your arms are straight.',
    ],
    alts: ['dumbbell-curl', 'cable-curl', 'hammer-curl'],
  },
  {
    id: 'dumbbell-curl', name: 'Dumbbell Curl', cat: 'Arms', equip: 'Dumbbells',
    cues: [
      'Palms up, elbows at your sides.',
      'Curl up and squeeze at the top.',
      'Lower slowly to straight arms.',
    ],
    alts: ['barbell-curl', 'incline-dumbbell-curl', 'cable-curl'],
  },
  {
    id: 'hammer-curl', name: 'Hammer Curl', cat: 'Arms', equip: 'Dumbbells',
    cues: [
      'Keep your palms facing each other the whole time.',
      'Curl without moving your elbows forward.',
      'Lower slowly.',
    ],
    alts: ['dumbbell-curl', 'cable-curl'],
  },
  {
    id: 'incline-dumbbell-curl', name: 'Incline Dumbbell Curl', cat: 'Arms', equip: 'Dumbbells and an incline bench',
    cues: [
      'Set the bench to about 45 degrees and let your arms hang straight down.',
      'Curl without letting your elbows drift forward.',
      'Lower to a full stretch.',
    ],
    alts: ['dumbbell-curl', 'barbell-curl'],
  },
  {
    id: 'cable-curl', name: 'Cable Curl', cat: 'Arms', equip: 'Cable machine, low pulley',
    cues: [
      'Stand close to the stack with your elbows at your sides.',
      'Curl the bar toward your shoulders and squeeze.',
      'Lower until your arms are straight, keeping tension on the cable.',
    ],
    alts: ['barbell-curl', 'dumbbell-curl', 'hammer-curl'],
  },
  {
    id: 'cable-triceps-pushdown', name: 'Cable Triceps Pushdown', cat: 'Arms', equip: 'Cable machine, high pulley',
    cues: [
      'Keep your elbows pinned to your sides.',
      'Push down until your arms are straight and squeeze.',
      'Let your hands rise only to chest height.',
    ],
    alts: ['overhead-cable-triceps-extension', 'skull-crusher', 'close-grip-bench-press'],
  },
  {
    id: 'overhead-cable-triceps-extension', name: 'Overhead Cable Triceps Extension', cat: 'Arms', equip: 'Cable machine with rope',
    cues: [
      'Face away from the stack with the rope behind your head, leaning forward slightly.',
      'Keep your elbows pointing forward and close together.',
      'Straighten your arms fully, then let the rope stretch your triceps.',
    ],
    alts: ['dumbbell-overhead-triceps-extension', 'cable-triceps-pushdown', 'skull-crusher'],
  },
  {
    id: 'dumbbell-overhead-triceps-extension', name: 'Dumbbell Overhead Triceps Extension', cat: 'Arms', equip: 'Dumbbell',
    cues: [
      'Hold one dumbbell with both hands above your head.',
      'Lower it behind your head with your elbows pointing up.',
      'Straighten your arms without flaring your elbows.',
    ],
    alts: ['overhead-cable-triceps-extension', 'skull-crusher'],
  },
  {
    id: 'skull-crusher', name: 'Barbell Skull Crusher', cat: 'Arms', equip: 'Barbell and a bench',
    cues: [
      'Lie on the bench with your arms straight over your shoulders.',
      'Bend only at the elbows, lowering the bar toward your forehead.',
      'Straighten your arms while keeping your upper arms still.',
    ],
    alts: ['dumbbell-overhead-triceps-extension', 'cable-triceps-pushdown', 'close-grip-bench-press'],
  },
  {
    id: 'close-grip-bench-press', name: 'Close-Grip Bench Press', cat: 'Arms', equip: 'Barbell and bench press',
    cues: [
      'Grip the bar at about shoulder width.',
      'Lower to your lower chest with your elbows tucked close to your body.',
      'Press up, letting your triceps do most of the work.',
    ],
    alts: ['skull-crusher', 'cable-triceps-pushdown'],
  },

  // ---------------- Core ----------------
  {
    id: 'cable-crunch', name: 'Cable Crunch', cat: 'Core', equip: 'Cable machine, high pulley with rope',
    cues: [
      'Kneel facing the stack with the rope beside your head.',
      'Curl your ribs down toward your hips while your hips stay still.',
      'Return slowly until your abs are stretched.',
    ],
    alts: ['lying-leg-raise', 'plank'],
  },
  {
    id: 'lying-leg-raise', name: 'Lying Leg Raise', cat: 'Core', equip: 'Bench or floor',
    cues: [
      'Lie flat with your hands under your hips or gripping the bench.',
      'Raise straight legs until they point at the ceiling.',
      "Lower slowly without letting your lower back arch.",
    ],
    alts: ['cable-crunch', 'plank'],
  },
  {
    id: 'plank', name: 'Plank', cat: 'Core', equip: 'Bodyweight',
    cues: [
      'Forearms under your shoulders, body in a straight line.',
      "Squeeze your glutes and abs. Don't let your hips sag.",
      'Log the seconds you held in the reps box.',
    ],
    alts: ['cable-crunch', 'lying-leg-raise'],
  },
  {
    id: 'cable-woodchop', name: 'Cable Woodchop', cat: 'Core', equip: 'Cable machine',
    cues: [
      'Stand side-on to the cable with your feet wide and knees soft.',
      'Turn through your hips and upper back and let your back foot pivot. Keep your lower back braced; it should not twist on its own.',
      'Keep your arms nearly straight and move under control, not with momentum.',
    ],
    // No other rotational exercise in the library, so no direct swap is offered.
    alts: [],
  },
];
