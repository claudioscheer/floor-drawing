/**
 * Multifamily demo layout seed.
 * - 4 apartments, each 6.00 × 6.00 m (36 m²) clear floor
 * - Recuo lateral 1.50 m
 * - Walls 0.20 m thick
 * 100 px = 1 m
 */

import type { DemoLayout, Group, ObjectType, PlanObject, PlanObjectOverrides } from "@fp/types";
import { createObject, DOOR_W, WALL_T } from "@fp/catalog";
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

    // --- Lot ---
    const OX = m(0.5);
    const OY = m(0.5);
    const SIDE = m(1.5); // recuo lateral
    const FRONT = m(3.0);
    const MOTO_D = m(3.0);
    const APT = m(6.0); // each apartment 6 × 6 m

    const BX = OX + SIDE;
    const BY = OY;
    const BLDG_W = APT;
    const BLDG_H = APT * 4; // 4 stacked apts → 24 m
    const PARK_X = BX + BLDG_W;
    const LOT_W = m(16);
    const LOT_H = BLDG_H + FRONT;
    const PARK_W = OX + LOT_W - PARK_X;

    /*
     * Strict 6.00 × 6.00 m room grid (must sum exactly on both axes):
     *
     *   ┌─ 2.50 ─┬──── 3.50 ────┐
     *   │ Banho  │ Quarto       │  2.50
     *   ├────────┼──────────────┤
     *   │Cozinha │ Sala Estar   │  3.50
     *   └────────┴──────────────┘
     *     2.50        3.50
     *
     *   2.50+3.50 = 6.00  (width and height)
     *   Areas: 6.25 + 8.75 + 8.75 + 12.25 = 36.00 m²
     */
    const BANHO_W = m(2.5);
    const QUARTO_W = APT - BANHO_W; // 3.5
    const TOP_H = m(2.5); // banho + quarto
    const BOT_H = APT - TOP_H; // 3.5 cozinha + estar
    const COZ_W = m(2.5); // same column as banho

    // Terrain
    add("terrain", {
      x: OX,
      y: OY,
      width: LOT_W,
      height: LOT_H,
      name: "Lot 16×27 m",
      showDimensions: true,
    });

    // Recuo lateral 1.50 m
    add("floor", {
      x: OX,
      y: OY,
      width: SIDE,
      height: BLDG_H,
      name: "Recuo lateral 1,50 m",
    });

    // Front free strip
    add("floor", {
      x: OX,
      y: OY + BLDG_H,
      width: LOT_W,
      height: FRONT,
      name: "Faixa frontal 3,00 m",
      showDimensions: true,
    });

    // Drive
    add("floor", {
      x: PARK_X,
      y: OY + MOTO_D,
      width: PARK_W,
      height: BLDG_H - MOTO_D,
      name: "Circulação de veículos",
    });

    // Motos
    add("floor", {
      x: PARK_X,
      y: OY,
      width: PARK_W,
      height: MOTO_D,
      name: "Motos 3,00 m",
      showDimensions: true,
    });

    // Car bays 2.80 × 5.00
    const BAY_W = m(2.8);
    const BAY_D = m(5);
    const bayX = OX + LOT_W - BAY_D - m(0.15);
    const bayY0 = OY + MOTO_D;
    const bayCount = Math.min(8, Math.floor((BLDG_H - MOTO_D) / BAY_W));
    for (let i = 0; i < bayCount; i++) {
      add("floor", {
        x: bayX,
        y: bayY0 + i * BAY_W,
        width: BAY_D,
        height: BAY_W,
        name: "Vaga " + (i + 1) + " (2,80×5,00)",
        showDimensions: i === 0,
      });
    }

    // --- Four identical 6×6 apartments (Apto 4 fundo → Apto 1 frente) ---
    // One template: same rooms, fixtures, doors, windows, wall segments.
    const groups: Group[] = [];

    /**
     * Build one apt at (ax, ay). Relative layout matches the approved plan:
     * Banho 2.5×2.5 · Quarto 3.5×2.5 · Cozinha 2.5×3.5 · Estar 3.5×3.5
     */
    function buildApartment(ax: number, ay: number, aptNum: number, isFundo: boolean, isFrente: boolean): void {
      const groupId = "apt-" + aptNum;
      groups.push({ id: groupId, name: "Apto " + aptNum, collapsed: false });
      const g = { groupId };
      const openY = ay + TOP_H;

      // Rooms (exact 6×6 grid)
      add("floor", { x: ax, y: ay, width: BANHO_W, height: TOP_H, name: "Banho", ...g });
      add("floor", {
        x: ax + BANHO_W,
        y: ay,
        width: QUARTO_W,
        height: TOP_H,
        name: "Quarto",
        ...g,
      });
      add("floor", {
        x: ax,
        y: openY,
        width: COZ_W,
        height: BOT_H,
        name: "Cozinha",
        ...g,
      });
      add("floor", {
        x: ax + COZ_W,
        y: openY,
        width: APT - COZ_W,
        height: BOT_H,
        name: "Sala Estar",
        ...g,
      });

      // Envelope walls — one segment per apt (shared party wall separate)
      add("wall", {
        x: ax,
        y: ay,
        width: t,
        height: APT,
        name: "Parede oeste",
        ...g,
      });
      add("wall", {
        x: ax + APT - t,
        y: ay,
        width: t,
        height: APT,
        name: "Parede leste",
        ...g,
      });
      if (isFundo) {
        add("wall", {
          x: ax,
          y: ay,
          width: APT,
          height: t,
          name: "Parede norte",
          ...g,
        });
      }
      if (isFrente) {
        add("wall", {
          x: ax,
          y: ay + APT - t,
          width: APT,
          height: t,
          name: "Parede sul",
          ...g,
        });
      }

      // Internal walls
      add("wall", {
        x: ax + BANHO_W - t / 2,
        y: ay,
        width: t,
        height: TOP_H,
        name: "Parede banho/quarto",
        ...g,
      });
      add("wall", {
        x: ax,
        y: openY - t / 2,
        width: APT,
        height: t,
        name: "Parede interna",
        ...g,
      });

      /*
       * Fixture layout — exact organization from approved apartment plan.
       * Relative coords (m) from apt origin (ax, ay). Copied identically to every apt.
       *
       * Banho 2.5×2.5:
       *   Box NW · Máquina NE · Pia/Tanque SW · Vaso mid-S · door on south wall
       * Quarto 3.5×2.5:
       *   Cama west · Roupeiro NE · door on south wall
       * Cozinha 2.5×3.5:
       *   Pia W · Fogão W · Armário SW · Geladeira SE (beside armário)
       * Estar 3.5×3.5:
       *   Mesa center-west · Sofá south · entrada east
       */

      // --- Banho ---
      add("floor", {
        x: ax + m(0.35),
        y: ay + m(0.25),
        width: m(1.3),
        height: m(1.0),
        name: "Box chuveiro",
        ...g,
      }); // 1.30 m²
      add("floor", {
        x: ax + m(1.75),
        y: ay + m(0.25),
        width: m(0.6),
        height: m(0.6),
        name: "Máquina de lavar",
        ...g,
      }); // 0.36 m²
      add("floor", {
        x: ax + m(0.25),
        y: ay + m(1.35),
        width: m(0.55),
        height: m(1.0),
        labelRotation: 270,
        name: "Pia / Tanque",
        ...g,
      }); // 0.55 m²
      // Vaso — just right of porta banho hinge (outside swing), 0.40 × 0.80
      // Matches plan: door swing left into free floor; vaso on hinge side
      add("floor", {
        x: ax + m(1.9),
        y: ay + TOP_H - m(0.8) - m(0.15),
        width: m(0.4),
        height: m(0.8),
        name: "Vaso",
        ...g,
      }); // 0.32 m²

      // --- Quarto ---
      add("floor", {
        x: ax + m(2.7),
        y: ay + m(0.3),
        width: m(1.4),
        height: m(1.7),
        name: "Cama",
        ...g,
      }); // 2.38 m² — ends x = ax+4.1
      // Roupeiro 1.50 × 0.40 = 0.60 m² (top-right of quarto)
      add("floor", {
        x: ax + APT - m(1.5) - m(0.25),
        y: ay + m(0.25),
        width: m(1.5),
        height: m(0.4),
        name: "Roupeiro",
        ...g,
      });

      // --- Cozinha (north clear for porta banho landing) ---
      add("floor", {
        x: ax + m(0.25),
        y: openY + m(0.55),
        width: m(0.6),
        height: m(1.2),
        labelRotation: 270,
        name: "Pia",
        ...g,
      }); // 0.72 m²
      add("floor", {
        x: ax + m(0.25),
        y: openY + m(1.95),
        width: m(0.6),
        height: m(0.6),
        name: "Fogão",
        ...g,
      }); // 0.36 m²
      // Armário + geladeira on south wall of kitchen (side by side)
      add("floor", {
        x: ax + m(0.25),
        y: ay + APT - m(0.6) - m(0.25),
        width: m(1.3),
        height: m(0.6),
        name: "Armário",
        ...g,
      }); // 0.78 m²
      add("floor", {
        x: ax + m(1.65),
        y: ay + APT - m(0.7) - m(0.25),
        width: m(0.7),
        height: m(0.7),
        name: "Geladeira",
        ...g,
      }); // 0.49 m²

      // --- Sala Estar ---
      // Mesa centered on cozinha | estar boundary
      add("floor", {
        x: ax + COZ_W - m(0.4),
        y: openY + (BOT_H - m(1.2)) / 2,
        width: m(0.8),
        height: m(1.2),
        name: "Mesa",
        ...g,
      }); // 0.96 m²
      add("floor", {
        x: ax + m(3.15),
        y: ay + APT - m(0.9) - m(0.3),
        width: m(1.8),
        height: m(0.9),
        name: "Sofá",
        ...g,
      }); // 1.62 m²

      // --- Doors ---
      // Porta banho 0.70 × wall — hinge right; swing up into banho (left of hinge)
      add("door", {
        x: ax + m(1.15),
        y: openY - t / 2,
        width: m(0.7),
        height: t,
        name: "Porta banho",
        hinge: "end",
        opens: "neg",
        ...g,
      }); // door ends ax+1.85; vaso starts ax+1.90
      // Porta quarto — east of bed (bed ends ax+4.1)
      add("door", {
        x: ax + BANHO_W + m(2.15),
        y: openY - t / 2,
        width: m(0.8),
        height: t,
        name: "Porta quarto",
        hinge: "end",
        opens: "neg",
        ...g,
      });
      add("door", {
        x: ax + APT - t,
        y: openY + m(1.1),
        width: t,
        height: DOOR_W,
        name: "Entrada",
        hinge: "start",
        opens: "neg",
        ...g,
      });

      // --- Windows ---
      add("window", {
        x: ax,
        y: ay + m(0.6),
        width: t,
        height: m(0.8),
        name: "Janela banho",
        ...g,
      });
      add("window", {
        x: ax,
        y: openY + m(0.9),
        width: t,
        height: m(1.1),
        name: "Janela cozinha",
        ...g,
      });
      add("window", {
        x: ax + APT - t,
        y: openY + m(2.0),
        width: t,
        height: m(1.0),
        name: "Janela estar",
        ...g,
      });
      // Janela quarto — lower on east wall, clear of roupeiro (top)
      add("window", {
        x: ax + APT - t,
        y: ay + m(1.25),
        width: t,
        height: m(1.0),
        name: "Janela quarto",
        ...g,
      });
    }

    for (let a = 0; a < 4; a++) {
      const ay = BY + a * APT;
      const aptNum = 4 - a;
      buildApartment(BX, ay, aptNum, a === 0, a === 3);
      // Shared party wall between this apt and the one toward the front
      if (a < 3) {
        add("wall", {
          x: BX,
          y: ay + APT - t / 2,
          width: APT,
          height: t,
          name: "Parede meação",
        });
      }
    }

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
    /*
     * Front fence (south): one small person gate + one vehicle gate.
     * - Portão pedestre: narrow, on the left (home / building side)
     * - Portão veículos: single leaf centered on the vehicle corridor
     *   (aisle between building east face and parking bays)
     */
    const PED_W = m(0.9); // person gate ~90 cm
    const VEH_W = m(3.5); // single car portão
    // Vehicle corridor = strip between building east face and parking stalls
    const aisleLeft = PARK_X;
    const aisleRight = bayX;
    const aisleMid = (aisleLeft + aisleRight) / 2;
    // Small person portal on the left (home / building side of the front)
    const pedX = BX + m(0.4);
    // Vehicle portão centered on the drive aisle
    const vehX = aisleMid - VEH_W / 2;
    const frontY = OY + LOT_H - t;
    const lotRight = OX + LOT_W;

    // Muro left of ped gate (covers recuo + building front)
    add("wall", {
      x: OX,
      y: frontY,
      width: pedX - OX,
      height: t,
      name: "Muro frente",
    });
    // Small pedestrian portal (persons living on the lot)
    add("door", {
      x: pedX,
      y: frontY,
      width: PED_W,
      height: t,
      name: "Portão pedestre",
      hinge: "start",
      opens: "neg",
    });
    // Muro between ped and vehicle gates
    add("wall", {
      x: pedX + PED_W,
      y: frontY,
      width: vehX - (pedX + PED_W),
      height: t,
      name: "Muro frente",
    });
    // Single vehicle portão on the drive corridor
    add("door", {
      x: vehX,
      y: frontY,
      width: VEH_W,
      height: t,
      name: "Portão veículos",
      hinge: "end",
      opens: "neg",
    });
    // Muro right of vehicle gate to lot corner
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

    return {
      objects: objs,
      groups: groups,
      groupSeq: groups.length + 1,
    };
  }
