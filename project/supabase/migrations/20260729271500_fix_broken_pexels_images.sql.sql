/*
# Fix product/reward images pointing to removed Pexels photos (404)
*/

UPDATE products
SET image = 'https://images.pexels.com/photos/851555/pexels-photo-851555.jpeg?auto=compress&cs=tinysrgb&w=800'
WHERE image LIKE '%/2304771/%' OR image LIKE '%pexels-photo-2304771%';

UPDATE products
SET image = 'https://images.pexels.com/photos/1775043/pexels-photo-1775043.jpeg?auto=compress&cs=tinysrgb&w=800'
WHERE image LIKE '%/2135/%' OR image LIKE '%pexels-photo-2135%';

UPDATE products
SET image = 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=800'
WHERE image LIKE '%/2599295/%' OR image LIKE '%pexels-photo-2599295%';

UPDATE rewards
SET image = 'https://images.pexels.com/photos/3226868/pexels-photo-3226868.jpeg?auto=compress&cs=tinysrgb&w=800'
WHERE image LIKE '%/312428/%' OR image LIKE '%pexels-photo-312428%';

UPDATE rewards
SET image = 'https://images.pexels.com/photos/1695052/pexels-photo-1695052.jpeg?auto=compress&cs=tinysrgb&w=800'
WHERE image LIKE '%/2198032/%' OR image LIKE '%pexels-photo-2198032%';
