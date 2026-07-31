function diagramStyleFormatter(customStyle: string, diagramId: string) {
  return `
	#${diagramId} .badge, #${diagramId} .label {
		text-shadow: none;
		line-height: unset;
		font-size: 0.75rem;
	}

	#${diagramId} foreignObject {
		overflow: visible;
	}
	
	#${diagramId} .edgeLabel, #${diagramId} .edgeLabel rect {
		background-color: transparent;
		fill: transparent;
	}

	/* A linked label must be clickable across its whole box, not only where a glyph is
	   painted: a sequence message's value sits below its label, so the arrow line runs
	   through the middle of the link and swallowed the click. */
	#${diagramId} a.diagram-link {
		pointer-events: bounding-box;
		cursor: pointer;
	}

	#${diagramId} .messageLine0, #${diagramId} .messageLine1 {
		pointer-events: none;
	}

	${customStyle}
	`;
}

export { diagramStyleFormatter };
