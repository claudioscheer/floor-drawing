/**
 * Multifamily demo layout seed.
 * - Lot 16.00 × 33.00 m
 * - Building 7.20 m wide × 30.00 m deep (+ 3.00 m faixa frontal)
 * - 4 identical apartments + central stair:
 *     Apto 4 · Apto 3 · Escada 2.00 m · Apto 2 · Apto 1
 * - Stairs 2.00 m; remaining 28.00 m / 4 → each apt 7.20 × 7.00 m (50.4 m²)
 * - Every apt is the same template stamp (rooms, fixtures, doors, windows)
 * - Walls 0.20 m thick · 100 px = 1 m
 */

import type { DemoLayout, Group, ObjectType, PlanObject, PlanObjectOverrides } from "@fp/types";
import { createObject, DOOR_W, WALL_T } from "@fp/catalog";
import { createDefaultStructure } from "@fp/projects";
import { m } from "@fp/units";

/**
 * Build the default multifamily plan shown on first load.
 * @returns Objects, groups, and next group sequence
 */
export function createDemoLayout(): DemoLayout {
  const t = WALL_T; // 0.20 m
  const objs: PlanObject[] = [];
  let seq = 0;
  const add = (type: ObjectType, overrides: PlanObjectOverrides & { groupId?: string } = {}): PlanObject => {
    seq += 1;
    const o = createObject(type, {
      id: type + "-" + seq,
      showDimensions: false,
      ...overrides,
    });
    objs.push(o);
    return o;
  };

  // --- Lot frame (FRENTE = +Y, FUNDO = −Y / top) ---
  const OX = m(0.5);
  const OY = m(0.5);
  const LOT_W = m(16);
  const LOT_H = m(33);
  const SIDE = m(1.5);
  const FRONT = m(3);
  const MOTO_D = m(3);

  // Building on left after side setback; depth = lot − front strip
  const BLDG_W = m(7.2);
  const BLDG_H = LOT_H - FRONT; // 30 m
  const BX = OX + SIDE;
  const BY = OY;

  /** Central stair core (dois lances) along building depth. */
  const STAIR_H = m(2.0);
  /** Clear apt depth: (30 − 2) / 4 = 7.00 m each. */
  const APT_H = (BLDG_H - STAIR_H) / 4;

  /*
   * Room grid 7.20 × 7.00 m:
   *
   *   ┌─ 2.80 ─┬──── 4.40 ────┐
   *   │ Banho  │ Quarto       │  3.00
   *   ├────────┼──────────────┤
   *   │Cozinha │ Sala Estar   │  4.00
   *   └────────┴──────────────┘
   *     3.00        4.20
   *
   *   Areas: 8.40 + 13.20 + 12.00 + 16.80 = 50.40 m²
   */
  const LEFT_W = m(2.8); // banho
  const RIGHT_W = BLDG_W - LEFT_W; // quarto
  const TOP_H = m(3.0); // banho + quarto depth
  const BOT_H = APT_H - TOP_H; // 4.0 open living + kitchen
  const COZ_W = m(3.0);

  const PARK_X = BX + BLDG_W;
  const PARK_W = OX + LOT_W - PARK_X;

  // Terrain
  add("terrain", {
    x: OX,
    y: OY,
    width: LOT_W,
    height: LOT_H,
    name: "Lot 16×33 m",
    showDimensions: true,
  });

  // Side setback
  add("room", {
    x: OX,
    y: OY,
    width: SIDE,
    height: BLDG_H,
    name: "Recuo lateral 1,50 m",
  });

  // Front free strip
  add("room", {
    x: OX,
    y: OY + BLDG_H,
    width: LOT_W,
    height: FRONT,
    name: "Faixa frontal 3,00 m",
    showDimensions: true,
  });

  // Drive
  add("room", {
    x: PARK_X,
    y: OY + MOTO_D,
    width: PARK_W,
    height: BLDG_H - MOTO_D,
    name: "Circulação de veículos",
  });

  // Motos
  add("room", {
    x: PARK_X,
    y: OY,
    width: PARK_W,
    height: MOTO_D,
    name: "Motos 3,00 m",
    showDimensions: true,
  });

  // 8 car bays 2.80 × 5.00
  const BAY_W = m(2.8);
  const BAY_D = m(5);
  const bayX = OX + LOT_W - BAY_D - m(0.15);
  const bayY0 = OY + MOTO_D;
  for (let i = 0; i < 8; i++) {
    add("room", {
      x: bayX,
      y: bayY0 + i * BAY_W,
      width: BAY_D,
      height: BAY_W,
      name: "Vaga " + (i + 1) + " (2,80×5,00)",
      showDimensions: i === 0,
    });
  }

  // --- Four apartments + central stair ---
  const groups: Group[] = [];

  /**
   * Stamp one apartment from a single template.
   * Same rooms, fixtures, doors, windows, and relative sizes on every apt.
   * Only world origin (ax, ay) and group id/name differ.
   */
  function buildApartment(ax: number, ay: number, aptNum: number): void {
    const groupId = "apt-" + aptNum;
    groups.push({ id: groupId, name: "Apto " + aptNum, collapsed: false });
    const g = { groupId };
    const openY = ay + TOP_H;

    // Rooms
    add("room", {
      x: ax,
      y: ay,
      width: LEFT_W,
      height: TOP_H,
      name: "Banho",
      ...g,
    });
    add("room", {
      x: ax + LEFT_W,
      y: ay,
      width: RIGHT_W,
      height: TOP_H,
      name: "Quarto",
      ...g,
    });
    add("room", {
      x: ax,
      y: openY,
      width: COZ_W,
      height: BOT_H,
      name: "Cozinha",
      ...g,
    });
    add("room", {
      x: ax + COZ_W,
      y: openY,
      width: BLDG_W - COZ_W,
      height: BOT_H,
      name: "Sala Estar",
      ...g,
    });

    /*
     * Banho 2.8 × 3.0
     *   Box NW · Vaso NE mid · Pia/Tanque SW · door south center
     */
    add("furniture", {
      x: ax + m(0.12),
      y: ay + m(0.12),
      width: m(1.6),
      height: m(1.0),
      name: "Box chuveiro",
      ...g,
    });
    add("furniture", {
      x: ax + LEFT_W - m(0.45) - m(0.15),
      y: ay + m(1.35),
      width: m(0.45),
      height: m(0.7),
      rotation: 90,
      name: "Vaso sanitário",
      ...g,
    });
    add("furniture", {
      x: ax + m(0.12),
      y: ay + TOP_H - m(1.2) - m(0.25),
      width: m(0.55),
      height: m(1.2),
      labelRotation: 270,
      name: "Pia / Tanque",
      ...g,
    });

    /*
     * Cozinha 3.0 × 4.0 — work triangle + laundry
     *   Armário N · Pia W · Fogão W · Bancada SW · Geladeira E · Máquina SE
     */
    add("furniture", {
      x: ax + m(0.12),
      y: openY + m(0.12),
      width: m(1.8),
      height: m(0.6),
      name: "Armário",
      ...g,
    });
    add("furniture", {
      x: ax + m(0.1),
      y: openY + m(0.9),
      width: m(0.6),
      height: m(1.2),
      labelRotation: 270,
      name: "Pia",
      ...g,
    });
    add("furniture", {
      x: ax + m(0.1),
      y: openY + m(2.3),
      width: m(0.6),
      height: m(0.6),
      name: "Fogão",
      ...g,
    });
    add("room", {
      x: ax + m(0.1),
      y: openY + m(3.05),
      width: m(0.6),
      height: m(0.8),
      labelRotation: 270,
      name: "Bancada",
      ...g,
    });
    add("furniture", {
      x: ax + COZ_W - m(0.7) - m(0.15),
      y: openY + m(1.5),
      width: m(0.7),
      height: m(0.7),
      name: "Geladeira",
      ...g,
    });
    // Máquina de lavar in the kitchen (laundry near sink / bancada)
    add("furniture", {
      x: ax + COZ_W - m(0.6) - m(0.15),
      y: openY + BOT_H - m(0.6) - m(0.2),
      width: m(0.6),
      height: m(0.6),
      name: "Máquina de lavar",
      ...g,
    });

    /*
     * Quarto 4.40 × 3.00
     *   Cama west · Roupeiro NE · Escrivaninha SE
     */
    add("furniture", {
      x: ax + LEFT_W + m(0.25),
      y: ay + m(0.3),
      width: m(1.4),
      height: m(1.9),
      name: "Cama",
      ...g,
    });
    add("furniture", {
      x: ax + BLDG_W - m(1.8) - m(0.25),
      y: ay + m(0.12),
      width: m(1.8),
      height: m(0.5),
      name: "Roupeiro",
      ...g,
    });
    // Desk under the east wall, south of the wardrobe (clear of bed)
    add("room", {
      x: ax + BLDG_W - m(1.2) - m(0.2),
      y: ay + m(1.0),
      width: m(1.2),
      height: m(0.55),
      name: "Escrivaninha",
      ...g,
    });

    // Sala Estar
    add("furniture", {
      x: ax + COZ_W - m(0.45),
      y: openY + (BOT_H - m(1.4)) / 2,
      width: m(0.9),
      height: m(1.4),
      name: "Mesa",
      ...g,
    });
    {
      const sofaL = m(1.8);
      const sofaD = m(0.9);
      const estarX = ax + COZ_W;
      const estarW = BLDG_W - COZ_W;
      add("furniture", {
        x: estarX + (estarW - sofaL) / 2,
        y: openY + BOT_H - sofaD - m(0.2),
        width: sofaL,
        height: sofaD,
        name: "Sofá",
        ...g,
      });
    }

    // Internal walls
    add("wall", {
      x: ax + LEFT_W - t / 2,
      y: ay,
      width: t,
      height: TOP_H,
      name: "Parede banho/quarto",
      ...g,
    });
    add("wall", {
      x: ax,
      y: openY - t / 2,
      width: BLDG_W,
      height: t,
      name: "Parede interna",
      ...g,
    });

    // Doors
    add("door", {
      x: ax + (LEFT_W - m(0.7)) / 2,
      y: openY - t / 2,
      width: m(0.7),
      height: t,
      name: "Porta banho",
      hinge: "end",
      opens: "neg",
      ...g,
    });
    add("door", {
      x: ax + LEFT_W + m(2.7),
      y: openY - t / 2,
      width: m(0.8),
      height: t,
      name: "Porta quarto",
      hinge: "end",
      opens: "neg",
      ...g,
    });
    add("door", {
      x: ax + BLDG_W - t,
      y: openY + m(1.2),
      width: t,
      height: DOOR_W,
      name: "Entrada",
      hinge: "start",
      opens: "neg",
      ...g,
    });

    // Windows
    add("window", {
      x: ax,
      y: ay + m(0.9),
      width: t,
      height: m(0.9),
      name: "Janela banho",
      ...g,
    });
    add("window", {
      x: ax,
      y: openY + m(1.1),
      width: t,
      height: m(1.2),
      name: "Janela cozinha",
      ...g,
    });
    add("window", {
      x: ax + BLDG_W - t,
      y: openY + m(2.5),
      width: t,
      height: m(1.2),
      name: "Janela estar",
      ...g,
    });
    add("window", {
      x: ax + BLDG_W - t,
      y: ay + m(0.8),
      width: t,
      height: m(1.1),
      name: "Janela quarto",
      ...g,
    });
  }

  /*
   * Stack (N → S): Apto 4 | Apto 3 | Escada 2.00 m | Apto 2 | Apto 1
   */
  const stairY = BY + 2 * APT_H;
  const aptOrigins: { ay: number; num: number }[] = [
    { ay: BY, num: 4 },
    { ay: BY + APT_H, num: 3 },
    { ay: stairY + STAIR_H, num: 2 },
    { ay: stairY + STAIR_H + APT_H, num: 1 },
  ];

  for (const a of aptOrigins) {
    buildApartment(BX, a.ay, a.num);
  }

  // Party walls between apt pairs (shared structure, not in apt groups)
  add("wall", {
    x: BX,
    y: BY + APT_H - t / 2,
    width: BLDG_W,
    height: t,
    name: "Parede meação",
  });
  add("wall", {
    x: BX,
    y: stairY - t / 2,
    width: BLDG_W,
    height: t,
    name: "Parede escada N",
  });
  add("wall", {
    x: BX,
    y: stairY + STAIR_H - t / 2,
    width: BLDG_W,
    height: t,
    name: "Parede escada S",
  });
  add("wall", {
    x: BX,
    y: stairY + STAIR_H + APT_H - t / 2,
    width: BLDG_W,
    height: t,
    name: "Parede meação",
  });

  // --- Central stair core ---
  groups.push({ id: "stair", name: "Escada", collapsed: false });
  const sg = { groupId: "stair" };

  add("room", {
    x: BX,
    y: stairY,
    width: BLDG_W,
    height: STAIR_H,
    name: "Escada 2,00 m",
    showDimensions: true,
    ...sg,
  });

  const LANDING_W = m(1.2);
  const FLIGHT_W = BLDG_W - LANDING_W;
  add("room", {
    x: BX + LANDING_W,
    y: stairY + m(0.15),
    width: FLIGHT_W - t,
    height: m(0.85),
    name: "Lance 1",
    ...sg,
  });
  add("room", {
    x: BX + LANDING_W,
    y: stairY + STAIR_H - m(0.15) - m(0.85),
    width: FLIGHT_W - t,
    height: m(0.85),
    name: "Lance 2",
    ...sg,
  });
  add("room", {
    x: BX + m(0.15),
    y: stairY + m(0.15),
    width: LANDING_W - m(0.3),
    height: STAIR_H - m(0.3),
    name: "Patamar",
    ...sg,
  });

  add("wall", {
    x: BX,
    y: stairY,
    width: t,
    height: STAIR_H,
    name: "Parede oeste escada",
    ...sg,
  });
  const stairDoorY = stairY + (STAIR_H - DOOR_W) / 2;
  add("wall", {
    x: BX + BLDG_W - t,
    y: stairY,
    width: t,
    height: stairDoorY - stairY,
    name: "Parede leste escada",
    ...sg,
  });
  add("wall", {
    x: BX + BLDG_W - t,
    y: stairDoorY + DOOR_W,
    width: t,
    height: stairY + STAIR_H - (stairDoorY + DOOR_W),
    name: "Parede leste escada",
    ...sg,
  });
  add("door", {
    x: BX + BLDG_W - t,
    y: stairDoorY,
    width: t,
    height: DOOR_W,
    name: "Acesso escada",
    hinge: "start",
    opens: "neg",
    ...sg,
  });

  // --- Building envelope ---
  add("wall", {
    x: BX,
    y: BY,
    width: BLDG_W,
    height: t,
    name: "Parede norte",
  });
  add("wall", {
    x: BX,
    y: BY + BLDG_H - t,
    width: BLDG_W,
    height: t,
    name: "Parede sul",
  });
  add("wall", {
    x: BX,
    y: BY,
    width: t,
    height: BLDG_H,
    name: "Parede oeste",
  });
  add("wall", {
    x: BX + BLDG_W - t,
    y: BY,
    width: t,
    height: BLDG_H,
    name: "Parede leste",
  });

  // --- Property perimeter fence ---
  add("wall", {
    x: OX,
    y: OY,
    width: LOT_W,
    height: t,
    name: "Muro fundo",
  });
  add("wall", {
    x: OX,
    y: OY,
    width: t,
    height: LOT_H,
    name: "Muro lateral",
  });
  add("wall", {
    x: OX + LOT_W - t,
    y: OY,
    width: t,
    height: LOT_H,
    name: "Muro lateral",
  });

  // Front: small ped gate on building side + vehicle gate on drive aisle
  const PED_W = m(0.9);
  const VEH_W = m(3.5);
  const aisleLeft = PARK_X;
  const aisleRight = bayX;
  const aisleMid = (aisleLeft + aisleRight) / 2;
  const pedX = BX + m(0.4);
  const vehX = aisleMid - VEH_W / 2;
  const frontY = OY + LOT_H - t;
  const lotRight = OX + LOT_W;

  add("wall", {
    x: OX,
    y: frontY,
    width: pedX - OX,
    height: t,
    name: "Muro frente",
  });
  add("door", {
    x: pedX,
    y: frontY,
    width: PED_W,
    height: t,
    name: "Portão pedestre",
    hinge: "start",
    opens: "neg",
  });
  add("wall", {
    x: pedX + PED_W,
    y: frontY,
    width: vehX - (pedX + PED_W),
    height: t,
    name: "Muro frente",
  });
  add("door", {
    x: vehX,
    y: frontY,
    width: VEH_W,
    height: t,
    name: "Portão veículos",
    hinge: "end",
    opens: "neg",
  });
  add("wall", {
    x: vehX + VEH_W,
    y: frontY,
    width: lotRight - (vehX + VEH_W),
    height: t,
    name: "Muro frente",
  });
  add("wall", {
    x: PARK_X,
    y: OY + MOTO_D - t,
    width: PARK_W,
    height: t,
    name: "Cobertura motos",
  });

  const structure = createDefaultStructure();
  const floorId = structure.floors[0].id;
  for (const o of objs) {
    o.floorId = floorId;
  }

  return {
    objects: objs,
    groups: groups,
    groupSeq: groups.length + 1,
    floors: structure.floors,
    floorSeq: structure.floorSeq,
  };
}
