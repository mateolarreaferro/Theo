"""
Load and inspect "Building Agency-Preserving Generative Systems" from .theo format.

Usage:
    # Inspect structure only (no API calls):
    python example_paper.py

    # Render all sections and write to output.txt:
    python example_paper.py --render

    # Render with agent feedback:
    python example_paper.py --render --agents

    # Specify output file:
    python example_paper.py --render -o my_essay.txt
"""

import sys
import theo

paper = theo.load("example_paper.theo")

if __name__ == "__main__":
    args = sys.argv[1:]

    if "--inspect" in args or "--render" not in args:
        paper.inspect()

    if "--render" in args:
        # Parse output file flag
        output = "output.txt"
        if "-o" in args:
            idx = args.index("-o")
            if idx + 1 < len(args):
                output = args[idx + 1]

        agents = []
        if "--agents" in args:
            agents = [theo.Critic(), theo.ObliqueStrategist(), theo.Facilitator()]

        rendered = paper.render(agents=agents, output=output)

        if paper.essay.feedback:
            paper.show_feedback()
