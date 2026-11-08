/*
  Built-in foods. Values are PER SERVING: kcal, p = protein (g), c = carbs (g), f = fat (g).

  Generic foods use typical USDA FoodData Central values.
  Entries with est: true are estimates: Filipino dishes vary a lot by recipe,
  and branded items (instant noodles, 3-in-1 coffee, whey) vary by brand.
  The app tells the user so and suggests creating their own food from the label.

  `tags` holds other words people search with (Tagalog names, common spellings).

  RULES
  - Never change or reuse an id: logged food entries point to it.
  - Keep values per the serving written in `serving`.
*/
window.FOODS = [
  // Rice, bread, carbs
  { id: 'rice-white', name: 'White rice, cooked', serving: '1 cup (158 g)', kcal: 205, p: 4.3, c: 44.5, f: 0.4, tags: 'kanin' },
  { id: 'rice-brown', name: 'Brown rice, cooked', serving: '1 cup (195 g)', kcal: 216, p: 5.0, c: 44.8, f: 1.8, tags: 'kanin' },
  { id: 'sinangag', name: 'Garlic fried rice (sinangag)', serving: '1 cup (170 g)', kcal: 280, p: 5, c: 46, f: 8, tags: 'kanin', est: true },
  { id: 'pandesal', name: 'Pandesal', serving: '1 piece (30 g)', kcal: 90, p: 2.6, c: 16, f: 1.5, tags: 'tinapay bread pan de sal', est: true },
  { id: 'bread-white', name: 'White bread', serving: '1 slice (25 g)', kcal: 67, p: 2.2, c: 12.7, f: 0.8, tags: 'tinapay loaf' },
  { id: 'bread-wheat', name: 'Whole wheat bread', serving: '1 slice (32 g)', kcal: 81, p: 4.0, c: 13.8, f: 1.1, tags: 'tinapay' },
  { id: 'oats', name: 'Rolled oats, dry', serving: '1/2 cup (40 g)', kcal: 150, p: 5, c: 27, f: 3, tags: 'oatmeal' },
  { id: 'pasta', name: 'Spaghetti or pasta, cooked', serving: '1 cup (140 g)', kcal: 221, p: 8.1, c: 43.2, f: 1.3, tags: 'noodles' },
  { id: 'pancit-canton', name: 'Instant pancit canton', serving: '1 pack (60 g)', kcal: 290, p: 6, c: 39, f: 12, tags: 'noodles instant', est: true },
  { id: 'pancit-bihon', name: 'Pancit bihon', serving: '1 cup (150 g)', kcal: 220, p: 9, c: 33, f: 6, tags: 'noodles', est: true },
  { id: 'kamote', name: 'Sweet potato (kamote), boiled', serving: '1 medium (150 g)', kcal: 114, p: 2.1, c: 26.6, f: 0.2, tags: 'camote' },
  { id: 'potato', name: 'Potato, boiled', serving: '1 medium (170 g)', kcal: 148, p: 3.2, c: 34.2, f: 0.2, tags: 'patatas' },
  { id: 'corn', name: 'Sweet corn, boiled', serving: '1 ear (100 g kernels)', kcal: 96, p: 3.4, c: 21, f: 1.5, tags: 'mais' },

  // Eggs, meat, fish, protein
  { id: 'egg-boiled', name: 'Egg, boiled', serving: '1 large (50 g)', kcal: 78, p: 6.3, c: 0.6, f: 5.3, tags: 'itlog' },
  { id: 'egg-fried', name: 'Egg, fried', serving: '1 large (46 g)', kcal: 90, p: 6.3, c: 0.4, f: 6.8, tags: 'itlog' },
  { id: 'egg-white', name: 'Egg white', serving: '1 large (33 g)', kcal: 17, p: 3.6, c: 0.2, f: 0.1, tags: 'itlog' },
  { id: 'chicken-breast', name: 'Chicken breast, skinless, cooked', serving: '100 g', kcal: 165, p: 31, c: 0, f: 3.6, tags: 'manok' },
  { id: 'chicken-thigh', name: 'Chicken thigh, skinless, cooked', serving: '100 g', kcal: 209, p: 26, c: 0, f: 10.9, tags: 'manok' },
  { id: 'chicken-fried', name: 'Fried chicken with skin', serving: '1 thigh (86 g)', kcal: 238, p: 18.6, c: 7.8, f: 14.2, tags: 'manok' },
  { id: 'chicken-adobo', name: 'Chicken adobo', serving: '1 serving (150 g)', kcal: 300, p: 25, c: 4, f: 20, tags: 'manok', est: true },
  { id: 'pork-adobo', name: 'Pork adobo', serving: '1 serving (150 g)', kcal: 400, p: 24, c: 4, f: 32, tags: 'baboy', est: true },
  { id: 'tinola', name: 'Chicken tinola', serving: '1 bowl (350 g)', kcal: 220, p: 24, c: 8, f: 10, tags: 'manok soup sabaw', est: true },
  { id: 'sinigang', name: 'Pork sinigang', serving: '1 bowl (350 g)', kcal: 250, p: 18, c: 8, f: 16, tags: 'baboy soup sabaw', est: true },
  { id: 'lechon-kawali', name: 'Fried pork belly (lechon kawali)', serving: '100 g', kcal: 520, p: 14, c: 0, f: 50, tags: 'baboy liempo', est: true },
  { id: 'pork-chop', name: 'Pork chop, lean, grilled', serving: '100 g', kcal: 206, p: 29, c: 0, f: 9, tags: 'baboy' },
  { id: 'beef-ground', name: 'Ground beef (80% lean), cooked', serving: '100 g', kcal: 254, p: 26, c: 0, f: 17, tags: 'baka giniling' },
  { id: 'tilapia', name: 'Tilapia, cooked', serving: '100 g', kcal: 128, p: 26.2, c: 0, f: 2.7, tags: 'isda fish' },
  { id: 'bangus', name: 'Milkfish (bangus), cooked', serving: '100 g', kcal: 190, p: 26, c: 0, f: 9, tags: 'isda fish', est: true },
  { id: 'tuna-can', name: 'Tuna, canned in water, drained', serving: '100 g', kcal: 116, p: 25.5, c: 0, f: 0.8, tags: 'isda fish' },
  { id: 'sardines', name: 'Sardines in tomato sauce, canned', serving: '1 can (155 g)', kcal: 250, p: 24, c: 6, f: 14, tags: 'isda sardinas fish', est: true },
  { id: 'corned-beef', name: 'Corned beef, canned', serving: '100 g', kcal: 250, p: 27, c: 0, f: 15, tags: 'baka' },
  { id: 'hotdog', name: 'Hotdog', serving: '1 piece (45 g)', kcal: 150, p: 5, c: 2, f: 13, est: true },
  { id: 'longganisa', name: 'Longganisa', serving: '1 piece (40 g)', kcal: 140, p: 6, c: 6, f: 10, tags: 'longanisa sausage', est: true },
  { id: 'tocino', name: 'Tocino', serving: '100 g', kcal: 330, p: 18, c: 20, f: 20, est: true },
  { id: 'tokwa', name: 'Tofu (tokwa), firm', serving: '100 g', kcal: 144, p: 17.3, c: 2.8, f: 8.7, tags: 'tofu tokua' },
  { id: 'monggo', name: 'Mung beans (monggo), boiled', serving: '1 cup (202 g)', kcal: 212, p: 14.2, c: 38.7, f: 0.8, tags: 'munggo mongo beans' },
  { id: 'whey', name: 'Whey protein powder', serving: '1 scoop (30 g)', kcal: 120, p: 24, c: 3, f: 1.5, tags: 'protein shake', est: true },
  { id: 'lumpia', name: 'Lumpiang shanghai', serving: '1 piece (25 g)', kcal: 60, p: 2.5, c: 4, f: 4, tags: 'lumpia spring roll', est: true },

  // Milk and dairy
  { id: 'milk-whole', name: 'Whole milk', serving: '1 cup (244 g)', kcal: 149, p: 7.7, c: 11.7, f: 7.9, tags: 'gatas fresh milk' },
  { id: 'milk-lowfat', name: 'Low-fat milk', serving: '1 cup (244 g)', kcal: 102, p: 8.2, c: 12.2, f: 2.4, tags: 'gatas' },
  { id: 'yogurt-greek', name: 'Greek yogurt, plain, nonfat', serving: '170 g', kcal: 100, p: 17, c: 6, f: 0.7, tags: 'yoghurt' },
  { id: 'cheese-slice', name: 'Processed cheese', serving: '1 slice (21 g)', kcal: 65, p: 3.5, c: 1.5, f: 5, tags: 'keso', est: true },

  // Fats and nuts
  { id: 'peanut-butter', name: 'Peanut butter', serving: '2 tbsp (32 g)', kcal: 190, p: 7, c: 7, f: 16, tags: 'mani' },
  { id: 'peanuts', name: 'Peanuts, roasted', serving: '28 g (a small handful)', kcal: 166, p: 6.7, c: 6.1, f: 14.1, tags: 'mani' },
  { id: 'oil', name: 'Cooking oil', serving: '1 tbsp (14 g)', kcal: 120, p: 0, c: 0, f: 14, tags: 'mantika' },
  { id: 'butter', name: 'Butter', serving: '1 tbsp (14 g)', kcal: 102, p: 0.1, c: 0, f: 11.5, tags: 'mantikilya' },
  { id: 'avocado', name: 'Avocado', serving: '1/2 fruit (100 g)', kcal: 160, p: 2, c: 8.5, f: 14.7 },

  // Fruit and vegetables
  { id: 'banana', name: 'Banana (lakatan)', serving: '1 medium (118 g)', kcal: 105, p: 1.3, c: 27, f: 0.4, tags: 'saging' },
  { id: 'saba', name: 'Saba banana, boiled', serving: '1 piece (100 g)', kcal: 110, p: 1.2, c: 28, f: 0.3, tags: 'saging nilagang', est: true },
  { id: 'mango', name: 'Ripe mango', serving: '1 cup sliced (165 g)', kcal: 99, p: 1.4, c: 24.7, f: 0.6, tags: 'mangga' },
  { id: 'apple', name: 'Apple', serving: '1 medium (182 g)', kcal: 95, p: 0.5, c: 25.1, f: 0.3, tags: 'mansanas' },
  { id: 'papaya', name: 'Papaya', serving: '1 cup (145 g)', kcal: 62, p: 0.7, c: 15.7, f: 0.4 },
  { id: 'pineapple', name: 'Pineapple', serving: '1 cup (165 g)', kcal: 82, p: 0.9, c: 21.6, f: 0.2, tags: 'pinya' },
  { id: 'orange', name: 'Orange', serving: '1 medium (131 g)', kcal: 62, p: 1.2, c: 15.4, f: 0.2, tags: 'dalandan' },
  { id: 'broccoli', name: 'Broccoli, boiled', serving: '1 cup (156 g)', kcal: 55, p: 3.7, c: 11.2, f: 0.6, tags: 'gulay' },
  { id: 'kangkong', name: 'Kangkong, cooked', serving: '1 cup (100 g)', kcal: 20, p: 2.6, c: 3.1, f: 0.2, tags: 'gulay water spinach', est: true },
  { id: 'chopsuey', name: 'Chop suey (mixed vegetables)', serving: '1 cup (150 g)', kcal: 120, p: 6, c: 10, f: 6, tags: 'gulay vegetables', est: true },

  // Drinks and snacks
  { id: 'coffee-3in1', name: 'Coffee 3-in-1', serving: '1 sachet (20 g)', kcal: 90, p: 1, c: 15, f: 3, tags: 'kape', est: true },
  { id: 'coffee-black', name: 'Black coffee', serving: '1 cup', kcal: 2, p: 0.3, c: 0, f: 0, tags: 'kape' },
  { id: 'soda', name: 'Soft drink (cola)', serving: '1 can (330 ml)', kcal: 139, p: 0, c: 35, f: 0, tags: 'softdrinks soda' },
  { id: 'turon', name: 'Turon', serving: '1 piece (80 g)', kcal: 200, p: 1.5, c: 35, f: 7, tags: 'banana spring roll', est: true },
  { id: 'siopao', name: 'Siopao asado', serving: '1 piece (120 g)', kcal: 280, p: 11, c: 42, f: 7, est: true },
];
