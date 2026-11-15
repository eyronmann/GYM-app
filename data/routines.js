/*
  Warm-up, mobility, posture and cooldown moves (window.MOVES), and the
  ready-made routines built from them (window.ROUTINES).

  These are general exercise guides, not treatment. Nothing here may claim to
  fix posture, cure pain or treat an injury.

  RULES
  - type must be one of: Warm-up, Mobility, Posture, Cooldown.
  - zone must be one of: Neck & shoulders, Upper back, Hips, Ankles, Wrists,
    Lower body, Core, Whole body.
  - Every id in a move's `alts` and in a routine's `moves` must exist in MOVES.
  - Warm-up moves keep you moving. Long still holds belong in Cooldown.
  - equip is what the move needs. Everything here works with a wall, a bench,
    the floor or nothing at all.
  - The mobility log copies names at save time, so renaming a move or routine
    never changes past entries.

  Each move: how = step-by-step, avoid = common mistakes and safety.
*/
window.MOVES = [
  // ---------------- Warm-up (keep moving, no long holds) ----------------
  {
    id: 'brisk-walk', name: 'Brisk Walk or Easy Jog', type: 'Warm-up', zone: 'Whole body',
    targets: 'Heart rate and body temperature', equip: 'None', dose: '3 to 5 minutes',
    how: [
      'Walk fast or jog slowly, on the spot if there is no room.',
      'Build up until you breathe a little harder but can still talk in full sentences.',
    ],
    avoid: ['Going hard enough to get tired. The goal is to feel warm.'],
    alts: ['high-knees'],
  },
  {
    id: 'arm-circles', name: 'Arm Circles', type: 'Warm-up', zone: 'Neck & shoulders',
    targets: 'Shoulder joints', equip: 'None', dose: '10 forward, 10 backward',
    how: [
      'Stand tall with your arms straight out to the sides.',
      'Draw small circles and make them bigger with each rep.',
      'Do all the forward circles, then reverse.',
    ],
    avoid: ['Arching your lower back as the circles get big. Keep your ribs down.', 'Swinging fast. Stay in control.'],
    alts: ['slow-shoulder-circle'],
  },
  {
    id: 'wrist-circles', name: 'Wrist Circles', type: 'Warm-up', zone: 'Wrists',
    targets: 'Wrist joints and forearms', equip: 'None', dose: '10 each direction',
    how: [
      'Hold your arms in front of you with loose fists.',
      'Draw the biggest circles you can with your fists, moving only at the wrist.',
      'Reverse the direction.',
    ],
    avoid: ['Moving your elbows or shoulders instead of the wrists.'],
    alts: ['wrist-rocks'],
  },
  {
    id: 'torso-twist', name: 'Standing Torso Twist', type: 'Warm-up', zone: 'Upper back',
    targets: 'Rotation of the upper back', equip: 'None', dose: '10 each side',
    how: [
      'Stand with feet shoulder-width apart and arms bent in front of your chest.',
      'Turn your chest to one side, then the other, in a smooth rhythm.',
      'Let your back heel lift so the hips can follow a little.',
    ],
    avoid: ['Forcing the end of the turn or jerking into it.', 'Twisting with your knees locked and feet glued down.'],
    alts: ['thread-the-needle'],
  },
  {
    id: 'leg-swings', name: 'Leg Swings', type: 'Warm-up', zone: 'Lower body',
    targets: 'Hips and hamstrings', equip: 'A wall or rack for balance', dose: '10 front to back and 10 side to side, each leg',
    how: [
      'Hold a rack or wall with one hand.',
      'Swing the outside leg forward and back in a relaxed way.',
      'Then face the wall and swing the leg across your body and out to the side.',
    ],
    avoid: ['Throwing your back into the swing. Keep your torso upright.', 'Kicking as high as you can from the first rep. Let the range grow.'],
    alts: ['active-leg-raise'],
  },
  {
    id: 'hip-circles', name: 'Standing Hip Circles', type: 'Warm-up', zone: 'Hips',
    targets: 'Hip joints', equip: 'A wall or rack for balance', dose: '8 each direction, each leg',
    how: [
      'Stand on one leg, holding something if you need to.',
      'Lift the other knee to hip height and draw a big circle with it.',
      'Reverse the direction, then switch legs.',
    ],
    avoid: ['Turning your whole body with the knee. Keep your hips facing forward.'],
    alts: ['ninety-ninety'],
  },
  {
    id: 'bodyweight-squat', name: 'Bodyweight Squat', type: 'Warm-up', zone: 'Lower body',
    targets: 'Hips, knees and ankles', equip: 'None', dose: '10 slow reps',
    how: [
      'Stand with feet shoulder-width apart and toes turned out a little.',
      'Sit down between your hips as deep as you can with your heels flat.',
      'Pause for a second at the bottom, then stand up.',
    ],
    avoid: ['Letting your heels lift or your knees cave inward.', 'Dropping fast and bouncing out of the bottom.'],
    alts: ['deep-squat-hold'],
  },
  {
    id: 'lunge-twist', name: 'Walking Lunge with Twist', type: 'Warm-up', zone: 'Hips',
    targets: 'Hips and upper back', equip: 'None', dose: '5 each side',
    how: [
      'Step into a long lunge and lower the back knee close to the floor.',
      'Turn your chest toward the front leg.',
      'Turn back, then step through into the next lunge.',
    ],
    avoid: ['Letting the front knee fall inward.', 'Short steps that push the front knee far past the toes.'],
    alts: ['worlds-greatest-stretch'],
  },
  {
    id: 'inchworm', name: 'Inchworm', type: 'Warm-up', zone: 'Whole body',
    targets: 'Hamstrings, shoulders and core', equip: 'None', dose: '5 reps',
    how: [
      'Bend forward and put your hands on the floor, bending your knees if you have to.',
      'Walk your hands out to a push-up position and hold a straight body for a second.',
      'Walk your feet up to your hands and stand.',
    ],
    avoid: ['Letting your hips sag in the push-up position.', 'Doing it on sore wrists. Use Leg Swings instead.'],
    alts: ['leg-swings'],
  },
  {
    id: 'scap-push-up', name: 'Scapular Push-Up', type: 'Warm-up', zone: 'Neck & shoulders',
    targets: 'Muscles that move the shoulder blades', equip: 'None, or a wall for the easier version', dose: '10 reps',
    how: [
      'Hold a push-up position with your arms locked straight.',
      'Let your chest sink between your shoulders.',
      'Push the floor away so your upper back rounds slightly.',
    ],
    avoid: ['Bending your elbows. Only the shoulder blades move.', 'Letting your hips drop or your head hang.'],
    alts: ['scap-retraction'],
  },
  {
    id: 'ankle-circles', name: 'Ankle Circles', type: 'Warm-up', zone: 'Ankles',
    targets: 'Ankle joints', equip: 'None', dose: '10 each direction, each foot',
    how: [
      'Lift one foot off the floor, holding something for balance if needed.',
      'Draw the biggest circle you can with your toes.',
      'Reverse the direction, then switch feet.',
    ],
    avoid: ['Moving from the knee or hip instead of the ankle.'],
    alts: ['knee-to-wall'],
  },
  {
    id: 'high-knees', name: 'High Knees', type: 'Warm-up', zone: 'Lower body',
    targets: 'Hip flexors and calves', equip: 'None', dose: '2 rounds of 20 seconds',
    how: [
      'Jog on the spot.',
      'Bring each knee up to about hip height.',
      'Stay tall and land on the balls of your feet.',
    ],
    avoid: ['Leaning back to get the knees higher.', 'Stomping. Keep the landings quiet.'],
    alts: ['brisk-walk'],
  },
  {
    id: 'butt-kicks', name: 'Butt Kicks', type: 'Warm-up', zone: 'Lower body',
    targets: 'Quads and hamstrings', equip: 'None', dose: '2 rounds of 20 seconds',
    how: [
      'Jog on the spot.',
      'Flick each heel up toward your backside.',
      'Keep your steps quick and light.',
    ],
    avoid: ['Letting your knees swing forward. They point down.'],
    alts: ['leg-swings'],
  },

  // ---------------- Mobility (slow, controlled range of motion) ----------------
  {
    id: 'neck-turns', name: 'Neck Turns and Tilts', type: 'Mobility', zone: 'Neck & shoulders',
    targets: 'Neck rotation and side bending', equip: 'None', dose: '5 slow reps each way',
    how: [
      'Sit or stand tall with your shoulders relaxed.',
      'Turn your head slowly to look over one shoulder, then the other.',
      'Then tilt one ear toward its shoulder, and the other.',
    ],
    avoid: ['Rolling your head in full circles or tipping it far back.', 'Pushing into pain, dizziness or tingling. Stop if you feel any.'],
    alts: ['upper-trap-stretch'],
  },
  {
    id: 'slow-shoulder-circle', name: 'Slow Shoulder Circle', type: 'Mobility', zone: 'Neck & shoulders',
    targets: 'Full shoulder range of motion', equip: 'None', dose: '3 each direction, each arm',
    how: [
      'Stand side-on to a wall, an arm-length away, body tight.',
      'Raise the arm nearest the wall forward and overhead as slowly as you can.',
      'Turn your palm out and keep going behind you to finish the circle.',
    ],
    avoid: ['Turning or leaning your body to get the arm around.', 'Rushing. One circle should take about 10 seconds.'],
    alts: ['arm-circles'],
  },
  {
    id: 'cat-cow', name: 'Cat-Cow', type: 'Mobility', zone: 'Upper back',
    targets: 'The whole spine', equip: 'None', dose: '10 slow reps',
    how: [
      'Get on hands and knees, hands under shoulders and knees under hips.',
      'Round your whole back up toward the ceiling and tuck your chin.',
      'Then let your chest drop and look slightly forward.',
    ],
    avoid: ['Moving only at the lower back. Try to move every part of the spine.', 'Holding your breath. Breathe out as you round.'],
    alts: ['bench-thoracic-extension'],
  },
  {
    id: 'thread-the-needle', name: 'Thread the Needle', type: 'Mobility', zone: 'Upper back',
    targets: 'Upper-back rotation', equip: 'None', dose: '8 each side',
    how: [
      'Start on hands and knees.',
      'Slide one arm under your body until that shoulder rests on the floor.',
      'Then reach the same arm up to the ceiling and follow it with your eyes.',
    ],
    avoid: ['Letting your hips shift sideways. Keep them over your knees.'],
    alts: ['open-book'],
  },
  {
    id: 'open-book', name: 'Open Book', type: 'Mobility', zone: 'Upper back',
    targets: 'Upper-back rotation and chest', equip: 'None', dose: '8 each side',
    how: [
      'Lie on your side with knees bent to 90 degrees and arms straight out in front, palms together.',
      'Lift the top arm and open it across to the other side, following it with your eyes.',
      'Pause, then close the book.',
    ],
    avoid: ['Letting your knees come apart or lift. They stay stacked.', 'Forcing the arm to the floor.'],
    alts: ['thread-the-needle'],
  },
  {
    id: 'worlds-greatest-stretch', name: "World's Greatest Stretch", type: 'Mobility', zone: 'Hips',
    targets: 'Hips, hamstrings and upper back', equip: 'None', dose: '5 each side',
    how: [
      'Step into a deep lunge with both hands on the floor inside the front foot.',
      'Drop the elbow nearest the front foot toward the floor, then reach that arm to the ceiling.',
      'Put the hand back down, straighten the front leg to stretch the hamstring, then return to the lunge.',
    ],
    avoid: ['Rounding your back to reach the floor. Put your hands on a bench instead.', 'Rushing between the three positions.'],
    alts: ['lunge-twist'],
  },
  {
    id: 'ninety-ninety', name: '90/90 Hip Switch', type: 'Mobility', zone: 'Hips',
    targets: 'Hip rotation, inward and outward', equip: 'None', dose: '8 each side',
    how: [
      'Sit with both knees bent to 90 degrees, one leg in front of you and one out to the side.',
      'Keeping your heels on the floor, rotate both knees over to the other side.',
      'Sit as tall as you can in each position.',
    ],
    avoid: ['Collapsing backward. Put your hands on the floor behind you if needed.', 'Forcing a knee down if it pinches.'],
    alts: ['hip-circles'],
  },
  {
    id: 'deep-squat-hold', name: 'Deep Squat Hold', type: 'Mobility', zone: 'Hips',
    targets: 'Hips and ankles in the bottom of a squat', equip: 'A rack or post to hold, if needed', dose: '2 holds of 30 to 45 seconds',
    how: [
      'Squat as low as you can with your heels flat. Hold a rack if you tip backward.',
      'Push your knees out with your elbows and lift your chest.',
      'Shift your weight gently from side to side.',
    ],
    avoid: ['Letting your heels come up.', 'Staying in it if your knees hurt. Hold higher or use the Bodyweight Squat.'],
    alts: ['bodyweight-squat'],
  },
  {
    id: 'knee-to-wall', name: 'Knee-to-Wall Ankle Stretch', type: 'Mobility', zone: 'Ankles',
    targets: 'How far the ankle bends forward', equip: 'A wall', dose: '10 each side',
    how: [
      'Stand facing a wall with one foot about a hand-width away from it.',
      'Drive that knee forward to touch the wall.',
      'If that is easy, move the foot back a little and repeat.',
    ],
    avoid: ['Letting the heel lift. It stays down the whole time.', 'Letting the knee drift inward. Aim it over your second toe.'],
    alts: ['calf-stretch'],
  },
  {
    id: 'wrist-rocks', name: 'Hands-and-Knees Wrist Rock', type: 'Mobility', zone: 'Wrists',
    targets: 'Wrist extension, used in push-ups and pressing', equip: 'None', dose: '10 slow rocks, fingers forward, then 10 with fingers turned out',
    how: [
      'Get on hands and knees with your palms flat and fingers pointing forward.',
      'Rock your shoulders slowly forward past your hands, then back.',
      'Turn your fingers out to the sides and repeat.',
    ],
    avoid: ['Putting your full weight on a sore wrist. Take weight off with your legs.', 'Letting the heel of the hand lift.'],
    alts: ['wrist-flexor-stretch'],
  },
  {
    id: 'wrist-flexor-stretch', name: 'Wrist Flexor Stretch', type: 'Mobility', zone: 'Wrists',
    targets: 'Inside of the forearm', equip: 'None', dose: '20 seconds each side',
    how: [
      'Hold one arm straight in front of you, palm up.',
      'With the other hand, gently pull the fingers down and back toward you.',
      'Keep the elbow straight.',
    ],
    avoid: ['Pulling hard. A mild stretch in the forearm is enough.'],
    alts: ['wrist-rocks'],
  },
  {
    id: 'wrist-extensor-stretch', name: 'Wrist Extensor Stretch', type: 'Mobility', zone: 'Wrists',
    targets: 'Top of the forearm', equip: 'None', dose: '20 seconds each side',
    how: [
      'Hold one arm straight in front of you, palm down.',
      'With the other hand, gently bend the wrist so the fingers point at the floor.',
      'Keep the elbow straight.',
    ],
    avoid: ['Pulling hard or bending the elbow to escape the stretch.'],
    alts: ['wrist-circles'],
  },
  {
    id: 'active-leg-raise', name: 'Lying Leg Raise', type: 'Mobility', zone: 'Lower body',
    targets: 'Hamstrings, moved by your own muscles', equip: 'None', dose: '8 each leg',
    how: [
      'Lie on your back with both legs straight.',
      'Keep one leg flat on the floor and raise the other, knee straight, as high as it goes.',
      'Lower it slowly and repeat.',
    ],
    avoid: ['Bending either knee or letting the bottom leg lift.', 'Letting your lower back arch off the floor.'],
    alts: ['hamstring-stretch'],
  },
  {
    id: 'adductor-rock', name: 'Adductor Rock-Back', type: 'Mobility', zone: 'Lower body',
    targets: 'Inner thighs', equip: 'None', dose: '8 each side',
    how: [
      'Get on hands and knees and stretch one leg straight out to the side, foot flat.',
      'Rock your hips back toward your heel until you feel the inner thigh of the straight leg.',
      'Rock forward and repeat.',
    ],
    avoid: ['Rounding your back as you rock. Keep it flat.'],
    alts: ['deep-squat-hold'],
  },

  // ---------------- Posture (strength and control for staying upright) ----------------
  {
    id: 'chin-tuck', name: 'Chin Tuck', type: 'Posture', zone: 'Neck & shoulders',
    targets: 'Deep muscles at the front of the neck', equip: 'None, or a wall behind your head', dose: '10 reps with a 3-second hold',
    how: [
      'Sit or stand tall and look straight ahead.',
      'Pull your head straight back, as if making a double chin.',
      'Hold, then relax.',
    ],
    avoid: ['Tipping your head up or down. It slides back level.', 'Pushing into pain or tingling. Stop if you feel any.'],
    alts: ['neck-turns'],
  },
  {
    id: 'wall-angel', name: 'Wall Angel', type: 'Posture', zone: 'Upper back',
    targets: 'Upper back and the muscles around the shoulder blades', equip: 'A wall', dose: '10 slow reps',
    how: [
      'Stand with your back, head and hips against a wall, feet a step forward.',
      'Put the backs of your arms on the wall in a goalpost shape.',
      'Slide your arms up overhead and back down.',
    ],
    avoid: ['Letting your lower back arch away from the wall.', 'Forcing your arms flat. Go only as far as you can keep contact.'],
    alts: ['prone-ytw'],
  },
  {
    id: 'scap-retraction', name: 'Standing Scapular Retraction', type: 'Posture', zone: 'Upper back',
    targets: 'Rhomboids and middle traps', equip: 'None', dose: '12 reps with a 3-second squeeze',
    how: [
      'Stand tall with your elbows bent at your sides.',
      'Pull your shoulder blades back and slightly down, as if pinching a pencil between them.',
      'Hold, then let them come forward again.',
    ],
    avoid: ['Shrugging your shoulders up toward your ears.', 'Pushing your ribs forward or arching your back to fake the squeeze.'],
    alts: ['prone-ytw', 'scap-push-up'],
  },
  {
    id: 'bench-thoracic-extension', name: 'Bench Thoracic Extension', type: 'Posture', zone: 'Upper back',
    targets: 'Backward bending of the upper back, and the lats', equip: 'A bench', dose: '8 reps with a 3-second pause',
    how: [
      'Kneel in front of a bench with your elbows on it and your hands together.',
      'Sit your hips back and let your chest sink toward the floor.',
      'Pause, then come back up.',
    ],
    avoid: ['Bending from the lower back. Keep your ribs tucked.', 'Pushing through shoulder pain.'],
    alts: ['cat-cow', 'wall-angel'],
  },
  {
    id: 'prone-ytw', name: 'Prone Y-T-W Raise', type: 'Posture', zone: 'Upper back',
    targets: 'Middle and lower traps, back of the shoulders', equip: 'The floor or an incline bench', dose: '8 of each letter',
    how: [
      'Lie face down with your forehead on the floor or on an incline bench.',
      'Lift your arms into a Y with thumbs pointing up, and lower them.',
      'Repeat as a T (arms out to the sides), then a W (elbows bent, pulled back).',
    ],
    avoid: ['Lifting your chest or craning your neck.', 'Adding weight before all three letters are easy.'],
    alts: ['scap-retraction', 'wall-angel'],
  },
  {
    id: 'doorway-chest-stretch', name: 'Doorway Chest Stretch', type: 'Posture', zone: 'Neck & shoulders',
    targets: 'Chest and front of the shoulders', equip: 'A door frame or rack upright', dose: '30 seconds each side',
    how: [
      'Put your forearm on a door frame or rack upright, elbow at shoulder height.',
      'Step through with the same-side foot.',
      'Turn your chest away until you feel a stretch across the chest.',
    ],
    avoid: ['Letting the shoulder ride up toward your ear.', 'Leaning in hard. The front of the shoulder should not pinch.'],
    alts: ['open-book'],
  },
  {
    id: 'dead-bug', name: 'Dead Bug', type: 'Posture', zone: 'Core',
    targets: 'Deep abdominal muscles', equip: 'None', dose: '8 each side',
    how: [
      'Lie on your back with your arms straight up and knees bent over your hips.',
      'Press your lower back into the floor.',
      'Slowly lower the opposite arm and leg toward the floor, return, and switch sides.',
    ],
    avoid: ['Letting your lower back lift off the floor. Shorten the reach if it does.', 'Rushing. Each rep takes about 4 seconds.'],
    alts: ['glute-bridge'],
  },
  {
    id: 'glute-bridge', name: 'Glute Bridge', type: 'Posture', zone: 'Hips',
    targets: 'Glutes', equip: 'None', dose: '12 reps with a 2-second squeeze',
    how: [
      'Lie on your back with knees bent and feet flat, hip-width apart.',
      'Push through your heels and lift your hips until your body is straight from knees to shoulders.',
      'Squeeze your glutes at the top, then lower.',
    ],
    avoid: ['Arching your lower back to get higher.', 'Pushing through your toes. You should feel glutes, not the lower back.'],
    alts: ['dead-bug'],
  },

  // ---------------- Cooldown (gentle, held stretches after training) ----------------
  {
    id: 'easy-walk', name: 'Easy Walk', type: 'Cooldown', zone: 'Whole body',
    targets: 'Bringing breathing and heart rate down', equip: 'None', dose: '3 to 5 minutes',
    how: [
      'Walk slowly.',
      'Keep going until your breathing is close to normal.',
    ],
    avoid: ['Sitting or lying down straight after a hard run or a heavy leg day.'],
    alts: [],
  },
  {
    id: 'upper-trap-stretch', name: 'Upper Trap Stretch', type: 'Cooldown', zone: 'Neck & shoulders',
    targets: 'Side of the neck and top of the shoulder', equip: 'None', dose: '20 to 30 seconds each side',
    how: [
      'Sit or stand tall and let one arm hang.',
      'Tilt your head away from that arm, ear toward the opposite shoulder.',
      'Rest the other hand on your head. Its weight is enough.',
    ],
    avoid: ['Pulling on your head.', 'Letting the stretched shoulder creep up.', 'Continuing through pain, dizziness or tingling.'],
    alts: ['neck-turns'],
  },
  {
    id: 'cross-body-shoulder-stretch', name: 'Cross-Body Shoulder Stretch', type: 'Cooldown', zone: 'Neck & shoulders',
    targets: 'Back of the shoulder', equip: 'None', dose: '30 seconds each side',
    how: [
      'Bring one arm straight across your chest.',
      'Use the other forearm to pull it closer.',
    ],
    avoid: ['Turning your chest to follow the arm.', 'Letting the shoulder ride up.'],
    alts: ['slow-shoulder-circle'],
  },
  {
    id: 'triceps-stretch', name: 'Overhead Triceps Stretch', type: 'Cooldown', zone: 'Neck & shoulders',
    targets: 'Triceps', equip: 'None', dose: '30 seconds each side',
    how: [
      'Reach one hand down between your shoulder blades.',
      'Use the other hand to press that elbow gently back.',
    ],
    avoid: ['Arching your back. Keep your ribs down.', 'Pushing your head forward with the arm.'],
    alts: [],
  },
  {
    id: 'lat-stretch', name: 'Rack Lat Stretch', type: 'Cooldown', zone: 'Upper back',
    targets: 'Lats, down the side of the back', equip: 'A rack upright or machine frame', dose: '30 seconds each side',
    how: [
      'Hold a rack upright with one hand at chest height.',
      'Sit your hips back and let that arm straighten.',
      'Lean away slightly until you feel the stretch down your side.',
    ],
    avoid: ['Hanging your whole weight off the arm.'],
    alts: ['childs-pose'],
  },
  {
    id: 'quad-stretch', name: 'Standing Quad Stretch', type: 'Cooldown', zone: 'Lower body',
    targets: 'Front of the thigh', equip: 'A wall or rack for balance', dose: '30 seconds each side',
    how: [
      'Hold something for balance.',
      'Pull one heel toward your backside with the same-side hand.',
      'Keep your knees together and push your hips slightly forward.',
    ],
    avoid: ['Arching your lower back.', 'Yanking the foot up. If the knee complains, ease off.'],
    alts: ['hip-flexor-stretch'],
  },
  {
    id: 'hamstring-stretch', name: 'Standing Hamstring Stretch', type: 'Cooldown', zone: 'Lower body',
    targets: 'Back of the thigh', equip: 'None', dose: '30 seconds each side',
    how: [
      'Put one heel on the floor in front of you with that leg straight.',
      'Bend the other knee slightly.',
      'Hinge forward from the hips with a flat back until you feel the stretch.',
    ],
    avoid: ['Rounding your back to reach further.', 'Bouncing.'],
    alts: ['active-leg-raise'],
  },
  {
    id: 'calf-stretch', name: 'Wall Calf Stretch', type: 'Cooldown', zone: 'Ankles',
    targets: 'Calves and Achilles tendon', equip: 'A wall', dose: '30 seconds each side, then 20 with the knee bent',
    how: [
      'Put your hands on a wall and step one leg back.',
      'Press the back heel into the floor and lean in with that knee straight.',
      'Then bend the back knee slightly to reach the lower calf.',
    ],
    avoid: ['Letting the back heel lift or the foot turn out.'],
    alts: ['knee-to-wall'],
  },
  {
    id: 'hip-flexor-stretch', name: 'Kneeling Hip Flexor Stretch', type: 'Cooldown', zone: 'Hips',
    targets: 'Front of the hip', equip: 'None. Kneel on a mat or towel', dose: '30 seconds each side',
    how: [
      'Kneel on one knee with the other foot in front.',
      'Tuck your tailbone under and squeeze the glute of the kneeling leg.',
      'Shift forward a little, keeping the tuck.',
    ],
    avoid: ['Arching your lower back and lunging far forward. The stretch belongs at the front of the hip.'],
    alts: ['quad-stretch'],
  },
  {
    id: 'figure-four-stretch', name: 'Figure-4 Glute Stretch', type: 'Cooldown', zone: 'Hips',
    targets: 'Glutes and outer hip', equip: 'None', dose: '30 seconds each side',
    how: [
      'Lie on your back and cross one ankle over the opposite knee.',
      'Pull the uncrossed leg toward your chest.',
      'Keep your head and shoulders relaxed on the floor.',
    ],
    avoid: ['Pulling so hard that your hips lift or the knee twists.'],
    alts: ['ninety-ninety'],
  },
  {
    id: 'childs-pose', name: "Child's Pose", type: 'Cooldown', zone: 'Whole body',
    targets: 'Back, hips and shoulders', equip: 'None', dose: '45 to 60 seconds',
    how: [
      'Kneel and sit back onto your heels.',
      'Reach your arms forward on the floor and rest your forehead down.',
      'Breathe slowly into your back.',
    ],
    avoid: ['Forcing your hips to your heels if your knees or ankles object. Put a towel behind the knees.'],
    alts: ['lat-stretch'],
  },
];

window.ROUTINES = [
  {
    id: 'warmup-full', name: 'Full-body warm-up', kind: 'Warm-up', when: 'Before any gym session', mins: 7,
    note: 'After this, do 2 lighter ramp-up sets of your first lift before the real sets: about half your working weight for 8 reps, then about three-quarters for 3 or 4.',
    moves: ['brisk-walk', 'arm-circles', 'leg-swings', 'bodyweight-squat', 'lunge-twist', 'inchworm', 'scap-push-up'],
  },
  {
    id: 'warmup-upper', name: 'Upper-body warm-up', kind: 'Warm-up', when: 'Before a chest, back, shoulder or arm day', mins: 7,
    note: 'After this, do 2 lighter ramp-up sets of your first lift before the real sets.',
    moves: ['brisk-walk', 'arm-circles', 'wrist-circles', 'torso-twist', 'cat-cow', 'scap-push-up', 'wall-angel'],
  },
  {
    id: 'warmup-lower', name: 'Lower-body warm-up', kind: 'Warm-up', when: 'Before a leg day', mins: 7,
    note: 'After this, do 2 lighter ramp-up sets of your first lift before the real sets.',
    moves: ['brisk-walk', 'ankle-circles', 'leg-swings', 'hip-circles', 'glute-bridge', 'bodyweight-squat', 'lunge-twist'],
  },
  {
    id: 'warmup-run', name: 'Warm-up before a run', kind: 'Warm-up', when: 'Before running or a fast walk', mins: 6,
    note: 'Start the run slower than you plan to finish it. The first 5 minutes are still part of the warm-up.',
    moves: ['brisk-walk', 'ankle-circles', 'leg-swings', 'hip-circles', 'high-knees', 'butt-kicks'],
  },
  {
    id: 'cooldown-full', name: 'Full-body cooldown', kind: 'Cooldown', when: 'After any gym session', mins: 9,
    note: 'Hold each stretch still and breathe slowly. Mild tension is enough. It should never hurt.',
    moves: ['easy-walk', 'quad-stretch', 'hamstring-stretch', 'hip-flexor-stretch', 'figure-four-stretch', 'doorway-chest-stretch', 'lat-stretch', 'childs-pose'],
  },
  {
    id: 'cooldown-upper', name: 'Upper-body cooldown', kind: 'Cooldown', when: 'After a chest, back, shoulder or arm day', mins: 7,
    note: 'Hold each stretch still and breathe slowly. Mild tension is enough. It should never hurt.',
    moves: ['doorway-chest-stretch', 'lat-stretch', 'cross-body-shoulder-stretch', 'triceps-stretch', 'upper-trap-stretch', 'wrist-flexor-stretch', 'childs-pose'],
  },
  {
    id: 'cooldown-lower', name: 'Lower-body cooldown', kind: 'Cooldown', when: 'After a leg day', mins: 8,
    note: 'Walk first, then stretch. Hold each stretch still. It should never hurt.',
    moves: ['easy-walk', 'quad-stretch', 'hamstring-stretch', 'hip-flexor-stretch', 'figure-four-stretch', 'calf-stretch', 'childs-pose'],
  },
  {
    id: 'cooldown-run', name: 'Cooldown after a run', kind: 'Cooldown', when: 'After running or a long walk', mins: 8,
    note: 'Walk first, then stretch. Hold each stretch still. It should never hurt.',
    moves: ['easy-walk', 'calf-stretch', 'hamstring-stretch', 'quad-stretch', 'hip-flexor-stretch', 'figure-four-stretch'],
  },
  {
    id: 'posture', name: 'Posture routine', kind: 'Posture', when: 'Any day, at home or at the gym', mins: 10,
    note: 'This is general strength and mobility work for the muscles that hold you upright. It is not treatment. If you have pain, numbness or an injury, see a doctor or physiotherapist first.',
    moves: ['chin-tuck', 'wall-angel', 'scap-retraction', 'bench-thoracic-extension', 'prone-ytw', 'doorway-chest-stretch', 'dead-bug', 'glute-bridge'],
  },
  {
    id: 'mobility', name: 'Mobility routine', kind: 'Mobility', when: 'Rest days, or after a warm-up', mins: 10,
    note: 'Move slowly and stay in control. Go to the edge of your range, not past it.',
    moves: ['neck-turns', 'cat-cow', 'thread-the-needle', 'worlds-greatest-stretch', 'ninety-ninety', 'deep-squat-hold', 'knee-to-wall', 'wrist-rocks'],
  },
];
