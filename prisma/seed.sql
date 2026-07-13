insert into "Tenant" (id, slug, name, "primaryColor", "accentColor", "logoText", domains) values
  ('foulard-teranga', 'foulard-teranga', 'Foulard Teranga', '#26326B', '#D07A34', 'Foulard Teranga', array['localhost', 'foulard-teranga.localhost']);

insert into "Product" (id, "tenantId", category, name, variant, price, stock, swatch, colors, motif, lengths, description, "oldPrice", badge, featured) values
  ('p1', 'foulard-teranga', 'Foulards', 'Foulard Wax Abidjan', 'Wax · 90×90', 12500, 24, 'repeating-linear-gradient(45deg,#e6d9c4,#e6d9c4 8px,#efe6d6 8px,#efe6d6 16px)', array['#26326B','#D07A34','#C9A227'], 'Wax', array['90 × 90 cm','Sur-mesure'], 'Coton wax authentique, imprimé vibrant inspiré des marchés d''Abidjan. Un incontournable du quotidien.', null, 'Nouveau', false),
  ('p2', 'foulard-teranga', 'Foulards', 'Foulard soie Kente', 'Soie · 70×70', 22000, 6, 'repeating-linear-gradient(45deg,#d8c9e0,#d8c9e0 8px,#e6dcec 8px,#e6dcec 16px)', array['#26326B','#0E9F6E','#C9A227'], 'Kente', array['70 × 70 cm','Sur-mesure'], 'Soie fluide au toucher précieux, tissage Kente aux couleurs chaudes. Notre pièce signature, en édition limitée.', null, '★ Coup de cœur', true),
  ('p3', 'foulard-teranga', 'Turbans', 'Turban Bazin Or', 'Bazin · brodé', 18000, 14, 'repeating-linear-gradient(45deg,#e6dcb4,#e6dcb4 8px,#f0e9cc 8px,#f0e9cc 16px)', array['#C9A227','#1E1B18'], 'Bazin', array['Taille unique'], 'Bazin riche brodé main, éclat doré pour les grandes occasions.', null, null, false),
  ('p4', 'foulard-teranga', 'Foulards', 'Foulard mousseline', 'Mousseline · 55×55', 7000, 31, 'repeating-linear-gradient(45deg,#d5e0dc,#d5e0dc 8px,#e4ece8 8px,#e4ece8 16px)', array['#0E9F6E','#26326B'], 'Uni', array['55 × 55 cm'], 'Mousseline légère et respirante, l''essentiel du quotidien, doux et facile à nouer.', null, null, false),
  ('p5', 'foulard-teranga', 'Tissus', 'Wax Vlisco 6 yards', 'Coton · 6 yd', 35000, 9, 'repeating-linear-gradient(45deg,#e0cfc0,#e0cfc0 8px,#ece0d4 8px,#ece0d4 16px)', array['#D07A34','#26326B'], 'Wax', array['6 yards'], 'Wax Vlisco authentique, motifs vibrants pour vos tenues sur-mesure.', null, null, false),
  ('p6', 'foulard-teranga', 'Tissus', 'Bazin riche', 'Damassé · 5 m', 28000, 4, 'repeating-linear-gradient(45deg,#cfd8e0,#cfd8e0 8px,#dfe6ec 8px,#dfe6ec 16px)', array['#26326B','#1E1B18'], 'Bazin', array['5 mètres'], 'Bazin riche damassé, éclat soutenu, pour vos grandes occasions.', 32000, null, false),
  ('p7', 'foulard-teranga', 'Tissus', 'Kente bande', 'Tissé main · 4 m', 40000, 11, 'repeating-linear-gradient(45deg,#e6c9c0,#e6c9c0 8px,#efdcd4 8px,#efdcd4 16px)', array['#D07A34','#C9A227','#26326B'], 'Kente', array['4 mètres'], 'Tissage Kente authentique, réalisé à la main, un drapé généreux et précieux.', null, '★ VIP', false),
  ('p8', 'foulard-teranga', 'Tissus', 'Pagne Woodin', 'Coton · 6 yd', 24000, 17, 'repeating-linear-gradient(45deg,#d0ddc9,#d0ddc9 8px,#e0ebda 8px,#e0ebda 16px)', array['#0E9F6E','#D07A34'], 'Wax', array['6 yards'], 'Pagne Woodin coloré, coton de qualité pour vos créations sur-mesure.', null, null, false),
  ('p9', 'foulard-teranga', 'Accessoires', 'Broche dorée', 'Laiton · plaqué', 4500, 22, 'repeating-linear-gradient(45deg,#e6dcb4,#e6dcb4 8px,#f0e9cc 8px,#f0e9cc 16px)', array['#C9A227'], 'Uni', array['Taille unique'], 'Broche en laiton plaqué or, l''accent parfait pour relever un foulard ou un turban.', null, null, false),
  ('p10', 'foulard-teranga', 'Accessoires', 'Boucles perles', 'Perles · fait main', 6000, 3, 'repeating-linear-gradient(45deg,#e0cfd6,#e0cfd6 8px,#ece0e6 8px,#ece0e6 16px)', array['#D07A34','#1E1B18'], 'Uni', array['Taille unique'], 'Boucles d''oreilles en perles faites main, légères et élégantes.', null, 'Nouveau', false),
  ('p11', 'foulard-teranga', 'Accessoires', 'Sac raphia', 'Raphia tressé', 15000, 8, 'repeating-linear-gradient(45deg,#e2d6bf,#e2d6bf 8px,#ece3d2 8px,#ece3d2 16px)', array['#C9A227','#26326B'], 'Uni', array['Taille unique'], 'Sac en raphia tressé à la main, la touche artisanale qui complète toute tenue.', null, null, false),
  ('p12', 'foulard-teranga', 'Accessoires', 'Pochette wax', 'Wax · doublée', 8000, 19, 'repeating-linear-gradient(45deg,#d9d2c4,#d9d2c4 8px,#e7e1d6 8px,#e7e1d6 16px)', array['#D07A34','#0E9F6E'], 'Wax', array['Taille unique'], 'Pochette en wax doublée, pratique et colorée pour vos sorties.', null, null, false);

insert into "Customer" (id, "tenantId", name, initials, phone, place, points, vip, segment) values
  ('c1', 'foulard-teranga', 'Aya Koffi', 'AK', '+225 07 12 45 67 89', 'Cocody, Abidjan', 186, true, 'VIP'),
  ('c2', 'foulard-teranga', 'Adjoua N'Guessan', 'AN', '+225 05 33 21 09 44', 'Yopougon, Abidjan', 92, false, 'Fidele'),
  ('c3', 'foulard-teranga', 'Mariam Traoré', 'MT', '+225 01 88 76 54 32', 'Plateau, Abidjan', 154, true, 'VIP'),
  ('c4', 'foulard-teranga', 'Fatou Bamba', 'FB', '+225 07 45 09 87 11', 'Marcory, Abidjan', 47, false, 'Fidele'),
  ('c5', 'foulard-teranga', 'Aminata Koné', 'AK', '+225 05 61 23 45 78', 'Bouaké', 23, false, 'Nouvelle'),
  ('c6', 'foulard-teranga', 'Grace Kouassi', 'GK', '+225 01 19 82 73 64', 'Riviera, Abidjan', 128, false, 'Fidele');

insert into "Order" (id, "tenantId", ref, "customerId", "clientName", place, phone, channel, status, "vipAtOrder", total) values
  ('TER-0492', 'foulard-teranga', '#TER-0492', 'c1', 'Aya Koffi', 'Cocody, Abidjan', '+225 07 12 45 67 89', 'Web', 'nouvelle', true, 54000),
  ('TER-0491', 'foulard-teranga', '#TER-0491', 'c4', 'Fatou Bamba', 'Marcory, Abidjan', '+225 07 45 09 87 11', 'WhatsApp', 'nouvelle', false, 31000),
  ('TER-0490', 'foulard-teranga', '#TER-0490', 'c5', 'Aminata Koné', 'Bouaké', '+225 05 61 23 45 78', 'Web', 'nouvelle', false, 12500),
  ('TER-0489', 'foulard-teranga', '#TER-0489', 'c3', 'Mariam Traoré', 'Plateau, Abidjan', '+225 01 88 76 54 32', 'Web', 'confirmee', true, 86000),
  ('TER-0488', 'foulard-teranga', '#TER-0488', 'c2', 'Adjoua N'Guessan', 'Yopougon, Abidjan', '+225 05 33 21 09 44', 'Boutique', 'preparation', false, 27500),
  ('TER-0487', 'foulard-teranga', '#TER-0487', 'c6', 'Grace Kouassi', 'Riviera, Abidjan', '+225 01 19 82 73 64', 'Web', 'livree', false, 42000),
  ('TER-0486', 'foulard-teranga', '#TER-0486', 'c4', 'Fatou Bamba', 'Marcory, Abidjan', '+225 07 45 09 87 11', 'Web', 'refusee', false, 7000);

insert into "OrderLine" (id, "orderId", "productId", "nameAtOrder", qty, "unitPrice", "lineTotal") values
  ('TER-0492-1', 'TER-0492', 'p2', 'Foulard soie Kente', 1, 22000, 22000),
  ('TER-0492-2', 'TER-0492', 'p3', 'Turban Bazin Or', 1, 18000, 18000),
  ('TER-0492-3', 'TER-0492', 'p9', 'Broche dorée', 2, 4500, 9000),
  ('TER-0491-1', 'TER-0491', 'p5', 'Wax Vlisco 6 yards', 1, 35000, 35000),
  ('TER-0490-1', 'TER-0490', 'p1', 'Foulard Wax Abidjan', 1, 12500, 12500),
  ('TER-0489-1', 'TER-0489', 'p7', 'Kente bande', 2, 40000, 80000),
  ('TER-0489-2', 'TER-0489', 'p12', 'Pochette wax', 1, 8000, 8000),
  ('TER-0488-1', 'TER-0488', 'p8', 'Pagne Woodin', 1, 24000, 24000),
  ('TER-0487-1', 'TER-0487', 'p6', 'Bazin riche', 1, 28000, 28000),
  ('TER-0486-1', 'TER-0486', 'p4', 'Foulard mousseline', 1, 7000, 7000);
