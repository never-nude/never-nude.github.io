export const museumPieces = {
  "sphinx": {
    kind: "stl",
    path: "/sphinx/",
    pageTitle: "Great Sphinx of Giza - Museum Viewer",
    viewerTitle: "Great Sphinx of Giza (c. 2558-2532 BCE)",
    lobbyTitle: "Great Sphinx of Giza (c. 2558-2532 BCE)",
    lobbyMeta: "Artist: Unknown Egyptian workshop (lifespan unknown)",
    model: {
      primaryUrl: "./sphinx_source.stl",
      fallbackUrl: "./sphinx_source.stl"
    },
    scene: {
      targetHeight: 1.58,
      rotateX: -Math.PI * 0.5
    }
  },
  "charioteer-of-delphi": {
    kind: "sketchfab",
    path: "/charioteer-of-delphi/",
    pageTitle: "Charioteer of Delphi - Museum Viewer",
    viewerTitle: "Charioteer of Delphi (c. 478-474 BCE)",
    subtitle: "Artist: Unknown Ancient Greek sculptor (lifespan unknown)",
    lobbyTitle: "Charioteer of Delphi (c. 478-474 BCE)",
    lobbyMeta: "Artist: Unknown Ancient Greek sculptor (lifespan unknown)",
    model: {
      uid: "0d55b629f1334200ab8efa7195e1450f",
      triangles: 508203,
      sourceBytes: 66185275
    }
  },
  "laocoon": {
    kind: "stl",
    path: "/laocoon/",
    pageTitle: "Laocoon and His Sons - Museum Viewer",
    viewerTitle: "Laocoon and His Sons (ancient group, c. 40-20 BCE)",
    subtitle: "Rendered from SMK's public-domain plaster-cast scan after the Vatican group; artist attribution: Hagesandros, Polydoros, and Athanodoros (traditional)",
    lobbyTitle: "Laocoon and His Sons (c. 40-20 BCE)",
    lobbyMeta: "Artist attribution: Hagesandros, Polydoros, and Athanodoros of Rhodes (traditional)",
    lobbyNote: "Rendered from SMK's public-domain cast scan.",
    defaults: {
      zoom: 3.9
    },
    model: {
      primaryUrl: "https://api.smk.dk/api/v1/download-3d/x059cd223_smk57-kas285-laocoon-group-decimated.stl",
      fallbackUrl: "https://api.smk.dk/api/v1/download-3d/r494vq86r_KAS285_small.stl"
    },
    scene: {
      targetHeight: 1.58,
      rotateX: -Math.PI * 0.5
    }
  },
  "donatello-saint-george": {
    kind: "sketchfab",
    path: "/donatello/saint-george/",
    pageTitle: "Donatello Saint George - Museum Viewer",
    viewerTitle: "Donatello: Saint George (c. 1415-1417)",
    subtitle: "Artist: Donatello (c. 1386-1466)",
    lobbyTitle: "Saint George (c. 1415-1417)",
    lobbyMeta: "Artist lifespan: c. 1386-1466",
    model: {
      uid: "b637727d39544f6d998ab996ded86f0c",
      triangles: 2000012,
      sourceBytes: 100000824
    }
  },
  "dying-gaul": {
    kind: "stl",
    path: "/dying-gaul/",
    pageTitle: "Dying Gaul - Museum Viewer",
    viewerTitle: "Dying Gaul (Roman copy after Hellenistic original, c. 230-220 BCE)",
    model: {
      primaryUrl: "https://api.smk.dk/api/v1/download-3d/4f16c782s_smk-190-inv-dying-gladiator.stl",
      fallbackUrl: "https://api.smk.dk/api/v1/download-3d/5t34sq60f_KAS1312_small.stl"
    },
    scene: {
      targetHeight: 1.58,
      rotateX: -Math.PI * 0.5
    }
  },
  "michelangelo-battle-of-the-centaurs": {
    kind: "stl",
    path: "/michelangelo/battle-of-the-centaurs/",
    pageTitle: "Michelangelo (1475-1564) Battle of the Centaurs (c. 1490-1492) - Museum Viewer",
    viewerTitle: "Michelangelo (1475-1564): Battle of the Centaurs (c. 1490-1492)",
    lobbyTitle: "Battle of the Centaurs (c. 1490-1492)",
    lobbyMeta: "Artist lifespan: 1475-1564",
    model: {
      primaryUrl: "./battle_of_the_centaurs_source.stl"
    },
    scene: {
      targetHeight: 1.58,
      rotateX: -Math.PI * 0.5
    }
  },
  "michelangelo-pieta": {
    kind: "stl",
    path: "/michelangelo/pieta/",
    pageTitle: "Michelangelo (1475-1564) Pieta (1497-1500) - Museum Viewer",
    viewerTitle: "Michelangelo (1475-1564): Pieta (1497-1500)",
    lobbyTitle: "Pieta (1497-1500)",
    lobbyMeta: "Artist lifespan: 1475-1564",
    model: {
      primaryUrl: "./pieta_source.stl",
      fallbackUrl: "./pieta_source_small.stl"
    },
    scene: {
      targetHeight: 1.58,
      rotateX: -Math.PI * 0.5
    }
  },
  "michelangelo-david": {
    kind: "stl",
    path: "/michelangelo/david/",
    pageTitle: "Michelangelo (1475-1564) David (1501-1504) - Museum Viewer",
    viewerTitle: "Michelangelo (1475-1564): David (1501-1504)",
    lobbyTitle: "David (1501-1504)",
    lobbyMeta: "Artist lifespan: 1475-1564",
    defaults: {
      zoom: 2.7
    },
    model: {
      primaryUrl: "./david_source.stl"
    },
    scene: {
      targetHeight: 1.82,
      rotateX: -Math.PI * 0.5
    }
  },
  "michelangelo-bruges-madonna": {
    kind: "stl",
    path: "/michelangelo/bruges-madonna/",
    pageTitle: "Michelangelo (1475-1564) Bruges Madonna (1501-1504) - Museum Viewer",
    viewerTitle: "Michelangelo (1475-1564): Bruges Madonna (1501-1504)",
    lobbyTitle: "Bruges Madonna (1501-1504)",
    lobbyMeta: "Artist lifespan: 1475-1564",
    model: {
      primaryUrl: "./bruges_madonna_source.stl",
      fallbackUrl: "./bruges_madonna_source_small.stl"
    },
    scene: {
      targetHeight: 1.58,
      rotateX: -Math.PI * 0.5
    }
  },
  "michelangelo-dying-slave": {
    kind: "stl",
    path: "/michelangelo/dying-slave/",
    pageTitle: "Michelangelo (1475-1564) Dying Slave (1513-1516) - Museum Viewer",
    viewerTitle: "Michelangelo (1475-1564): Dying Slave (1513-1516)",
    lobbyTitle: "Dying Slave (1513-1516)",
    lobbyMeta: "Artist lifespan: 1475-1564",
    model: {
      primaryUrl: "./dying_slave_source.stl",
      fallbackUrl: "./dying_slave_source_small.stl"
    },
    scene: {
      targetHeight: 1.58,
      rotateX: -Math.PI * 0.5
    }
  },
  "michelangelo-prisoner": {
    kind: "stl",
    path: "/michelangelo/prisoner/",
    pageTitle: "Michelangelo (1475-1564) Prisoner (c. 1519) - Museum Viewer",
    viewerTitle: "Michelangelo (1475-1564): Prisoner (c. 1519)",
    lobbyTitle: "Prisoner (c. 1519)",
    lobbyMeta: "Artist lifespan: 1475-1564",
    model: {
      primaryUrl: "./prisoner_source.stl",
      fallbackUrl: "./prisoner_source_small.stl"
    },
    scene: {
      targetHeight: 1.58,
      rotateX: -Math.PI * 0.5
    }
  },
  "michelangelo-dawn": {
    kind: "stl",
    path: "/michelangelo/dawn/",
    pageTitle: "Michelangelo (1475-1564) Dawn (1524-1531) - Museum Viewer",
    viewerTitle: "Michelangelo (1475-1564): Dawn (1524-1531)",
    lobbyTitle: "Dawn (1524-1531)",
    lobbyMeta: "Artist lifespan: 1475-1564",
    model: {
      primaryUrl: "https://api.smk.dk/api/v1/download-3d/k643b617z_smk-kas113-3-allegory-of-dawn.stl",
      fallbackUrl: "./dawn_source_small.stl"
    },
    scene: {
      targetHeight: 1.58,
      defaultYaw: Math.PI * 0.5,
      rotateX: 0
    }
  },
  "michelangelo-dusk": {
    kind: "stl",
    path: "/michelangelo/dusk/",
    pageTitle: "Michelangelo (1475-1564) Dusk (1524-1531) - Museum Viewer",
    viewerTitle: "Michelangelo (1475-1564): Dusk (1524-1531)",
    lobbyTitle: "Dusk (1524-1531)",
    lobbyMeta: "Artist lifespan: 1475-1564",
    model: {
      primaryUrl: "https://api.smk.dk/api/v1/download-3d/3n204405h_smk-kas113-2-allegory-of-dusk.stl",
      fallbackUrl: "./dusk_source_small.stl"
    },
    scene: {
      targetHeight: 1.58,
      rotateX: -Math.PI * 0.5
    }
  },
  "michelangelo-giuliano-duke-of-nemours": {
    kind: "stl",
    path: "/michelangelo/giuliano-duke-of-nemours/",
    pageTitle: "Michelangelo (1475-1564) Giuliano Duke of Nemours (1526-1534) - Museum Viewer",
    viewerTitle: "Michelangelo (1475-1564): Giuliano, Duke of Nemours (1526-1534)",
    lobbyTitle: "Giuliano, Duke of Nemours (1526-1534)",
    lobbyMeta: "Artist lifespan: 1475-1564",
    model: {
      primaryUrl: "https://api.smk.dk/api/v1/download-3d/dn39x6162_smk-kas112-1-guiliano-de-medici-decimated.stl",
      fallbackUrl: "./giuliano_source_small.stl"
    },
    scene: {
      targetHeight: 1.58,
      rotateX: 0
    }
  },
  "michelangelo-lorenzo-duke-of-urbino": {
    kind: "stl",
    path: "/michelangelo/lorenzo-duke-of-urbino/",
    pageTitle: "Michelangelo (1475-1564) Lorenzo Duke of Urbino (1526-1534) - Museum Viewer",
    viewerTitle: "Michelangelo (1475-1564): Lorenzo, Duke of Urbino (1526-1534)",
    lobbyTitle: "Lorenzo, Duke of Urbino (1526-1534)",
    lobbyMeta: "Artist lifespan: 1475-1564",
    model: {
      primaryUrl: "https://api.smk.dk/api/v1/download-3d/df65vd372_smk-kas113-1-lorenzo-de-medici-decimated.stl",
      fallbackUrl: "./lorenzo_source_small.stl"
    },
    scene: {
      targetHeight: 1.58,
      rotateX: 0
    }
  },
  "michelangelo-night": {
    kind: "stl",
    path: "/michelangelo/night/",
    pageTitle: "Michelangelo (1475-1564) Night (Notte) (1526-1531) - Museum Viewer",
    viewerTitle: "Michelangelo (1475-1564): Night (Notte) (1526-1531)",
    lobbyTitle: "Night (Notte) (1526-1531)",
    lobbyMeta: "Artist lifespan: 1475-1564",
    model: {
      primaryUrl: "https://api.smk.dk/api/v1/download-3d/mg74qr55m_smk-kas112-2-night.stl",
      fallbackUrl: "./night_source_small.stl"
    },
    scene: {
      targetHeight: 1.58,
      defaultYaw: Math.PI,
      rotateX: -Math.PI * 0.5
    }
  }
};

export const museumLobby = {
  pageTitle: "ad-arma Museum - Lobby",
  title: "ad-arma Museum Lobby",
  subtitle: "Sculpture and 3D works from antiquity through the nineteenth century. Each listing includes year and artist lifespan.",
  sections: [
    {
      title: "Antiquity",
      subtitle: "Early monumental works",
      items: ["sphinx", "charioteer-of-delphi", "laocoon"]
    },
    {
      title: "Donatello",
      subtitle: "Artist: Donatello (c. 1386-1466)",
      items: ["donatello-saint-george"]
    },
    {
      title: "Michelangelo",
      subtitle: "Artist: Michelangelo Buonarroti (1475-1564)",
      items: [
        "michelangelo-battle-of-the-centaurs",
        "michelangelo-pieta",
        "michelangelo-david",
        "michelangelo-bruges-madonna",
        "michelangelo-dying-slave",
        "michelangelo-prisoner",
        {
          href: "/michelangelo/medici-madonna/",
          title: "Medici Madonna (c. 1521-1534)",
          meta: "Artist lifespan: 1475-1564"
        },
        {
          pieceId: "michelangelo-dawn",
          href: "/michelangelo/dawn/?v=20260312-0757"
        },
        "michelangelo-dusk",
        "michelangelo-giuliano-duke-of-nemours",
        "michelangelo-lorenzo-duke-of-urbino",
        "michelangelo-night"
      ]
    }
  ]
};
