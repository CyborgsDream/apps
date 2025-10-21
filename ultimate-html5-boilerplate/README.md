# Ultimate HTML5 Boilerplate

**Project Name:** Ultimate HTML5 Boilerplate  
**Version:** 0.0.1  
**Codename:** Aurora

This boilerplate is designed as a future-proof foundation for rich web applications and browser-based games. It combines modern HTML5 best practices, a modular JavaScript architecture, responsive styling, and progressive web app capabilities.

## Features
- Progressive web app-ready with manifest, service worker, and offline caching hooks
- Modular ES module architecture for game systems and UI components
- Structured state management and event bus for decoupled communication
- Animation-ready main loop scaffold with delta timing and lifecycle hooks
- Responsive CSS with custom properties, prefers-reduced-motion handling, and layout utilities
- Centralized logging pipeline enriched with version, codename, and timestamps
- Comprehensive documentation and logging via CHANGELOG and DEVLOG

## Getting Started
1. Serve the project locally (for example, using `npx http-server` from the project root).
2. Update `project.meta.json` with your own project name, version, and codename when you fork the boilerplate.
3. Customize assets, styles, and scripts under the `assets`, `styles`, and `scripts` directories.
4. Extend the event-driven systems or replace the game loop with your own rendering engine.

## Scripts
- `scripts/main.js` bootstraps the application, registers the service worker, and wires core systems.
- `scripts/systems/gameLoop.js` exposes an animation-ready update loop.
- `scripts/core/state.js` and `scripts/core/eventBus.js` provide shared state and messaging utilities.
- `scripts/core/logger.js` surfaces a project-aware logging interface.

## Logs
See `logs/CHANGELOG.md` for versioned changes and `logs/DEVLOG.md` for ongoing development notes.

## License
This boilerplate is provided as-is. Customize freely for your own projects.
