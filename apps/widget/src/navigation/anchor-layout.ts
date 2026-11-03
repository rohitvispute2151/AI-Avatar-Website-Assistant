export interface AvatarAnchor {
  x: number; // px from left of viewport
  y: number; // px from top of viewport
  side: "left" | "right" | "top" | "bottom";
  scale: number;
  useBottomAnchor: boolean;
  needsScrollToTop?: boolean;
}

interface CandidateSlot {
  x: number;
  y: number;
  side: "left" | "right" | "top" | "bottom";
  scale: number;
  score: number;
  hasTargetOverlap: boolean;
  hasChatOverlap: boolean;
}

function checkRectOverlap(
  r1: { left: number; top: number; right: number; bottom: number },
  r2: { left: number; top: number; right: number; bottom: number },
  margin: number = 0
): boolean {
  return !(
    r1.right + margin <= r2.left ||
    r1.left - margin >= r2.right ||
    r1.bottom + margin <= r2.top ||
    r1.top - margin >= r2.bottom
  );
}

/**
 * Calculates a collision-free avatar placement driven by the target element's bounding rect.
 *
 * Requirements:
 * 1. The avatar's bounding box MUST NOT intersect the target rect (with 16-24px margin).
 * 2. The avatar MUST NOT intersect the chat panel.
 * 3. Candidates evaluated in order of preference:
 *    - Free horizontal gutter at left of viewport
 *    - Free horizontal gutter at right of viewport
 *    - Area below target (in bottom gap)
 *    - Area above target (in top gap)
 *    - Side pocket beside content
 * 4. The avatar is fully visible (head to feet) with padding from viewport edges at all times.
 */
export function calculateAvatarAnchor(
  targetRect: DOMRect,
  stageWidth: number = 290,
  stageHeight: number = 550,
  viewportMargin: number = 20,
  isChatOpen: boolean = true,
  chatRect?: DOMRect | null
): AvatarAnchor {
  const vpWidth = typeof window !== "undefined" ? window.innerWidth : 1366;
  const vpHeight = typeof window !== "undefined" ? window.innerHeight : 768;

  const isMobile = vpWidth < 768;
  const targetWidth = targetRect.width;
  const isTargetWide = targetWidth > vpWidth * 0.55;

  // Scale candidates: prefer natural scale (~0.85), gently reduce to 0.75 or 0.65 (mobile)
  const candidateScales = isMobile ? [0.65] : isTargetWide ? [0.75, 0.70] : [0.85, 0.80];

  const chatBounds = chatRect
    ? { left: chatRect.left, top: chatRect.top, right: chatRect.right, bottom: chatRect.bottom }
    : isChatOpen
      ? { left: vpWidth - 360, top: vpHeight - 420, right: vpWidth - 16, bottom: vpHeight - 16 }
      : null;

  const targetBounds = {
    left: targetRect.left,
    top: targetRect.top,
    right: targetRect.right,
    bottom: targetRect.bottom,
  };

  let bestCandidate: CandidateSlot | null = null;

  for (const scale of candidateScales) {
    const effW = Math.round(stageWidth * scale);
    const effH = Math.round(stageHeight * scale);
    const clearanceMargin = 20;

    // Slots to evaluate:
    const slots: Array<{ x: number; y: number; side: "left" | "right" | "top" | "bottom"; basePreference: number }> = [];

    // 1. Left Gutter (grounded at bottom)
    const leftGutterX = viewportMargin;
    const groundedY = vpHeight - effH - viewportMargin;
    slots.push({
      x: leftGutterX,
      y: groundedY,
      side: "left",
      basePreference: 1000,
    });

    // 2. Right Gutter (grounded at bottom)
    const rightGutterX = vpWidth - effW - viewportMargin;
    slots.push({
      x: rightGutterX,
      y: groundedY,
      side: "right",
      basePreference: 950,
    });

    // 3. Below Target (Bottom Area, when target is in upper part of viewport)
    if (targetBounds.bottom + clearanceMargin < vpHeight - effH) {
      // Bottom left below target
      slots.push({
        x: Math.max(viewportMargin, Math.min(targetBounds.left, vpWidth - effW - viewportMargin)),
        y: groundedY,
        side: "bottom",
        basePreference: 900,
      });
      // Bottom right below target
      slots.push({
        x: Math.max(viewportMargin, Math.min(targetBounds.right - effW, vpWidth - effW - viewportMargin)),
        y: groundedY,
        side: "bottom",
        basePreference: 890,
      });
    }

    // 4. Above Target (Top Area, when target is in lower part of viewport)
    if (targetBounds.top - clearanceMargin > effH + 60) {
      slots.push({
        x: viewportMargin,
        y: 60 + viewportMargin,
        side: "top",
        basePreference: 800,
      });
      slots.push({
        x: vpWidth - effW - viewportMargin,
        y: 60 + viewportMargin,
        side: "top",
        basePreference: 790,
      });
    }

    // 5. Side Pockets immediately beside target if room exists
    const leftPocketX = targetBounds.left - effW - clearanceMargin;
    if (leftPocketX >= viewportMargin) {
      slots.push({
        x: leftPocketX,
        y: groundedY,
        side: "left",
        basePreference: 880,
      });
    }
    const rightPocketX = targetBounds.right + clearanceMargin;
    if (rightPocketX + effW <= vpWidth - viewportMargin) {
      slots.push({
        x: rightPocketX,
        y: groundedY,
        side: "right",
        basePreference: 870,
      });
    }

    // Evaluate each candidate
    for (const slot of slots) {
      const candBounds = {
        left: slot.x,
        top: slot.y,
        right: slot.x + effW,
        bottom: slot.y + effH,
      };

      const hasTargetOverlap = checkRectOverlap(candBounds, targetBounds, clearanceMargin);
      const hasChatOverlap = chatBounds ? checkRectOverlap(candBounds, chatBounds, 12) : false;

      let score = slot.basePreference;

      if (hasTargetOverlap) {
        const overlapX = Math.max(0, Math.min(candBounds.right, targetBounds.right) - Math.max(candBounds.left, targetBounds.left));
        const overlapY = Math.max(0, Math.min(candBounds.bottom, targetBounds.bottom) - Math.max(candBounds.top, targetBounds.top));
        score -= (50000 + (overlapX * overlapY));
      } else {
        // Reward clearance from target
        const distToTarget = Math.min(
          Math.abs(candBounds.left - targetBounds.right),
          Math.abs(candBounds.right - targetBounds.left),
          Math.abs(candBounds.top - targetBounds.bottom),
          Math.abs(candBounds.bottom - targetBounds.top)
        );
        score += distToTarget;
      }

      if (hasChatOverlap) {
        score -= 20000; // Strong rejection of chat panel collision
      }

      // Check viewport containment
      if (
        candBounds.left < viewportMargin ||
        candBounds.right > vpWidth - viewportMargin ||
        candBounds.top < 10 ||
        candBounds.bottom > vpHeight - 8
      ) {
        score -= 10000;
      }

      const candidate: CandidateSlot = {
        x: slot.x,
        y: slot.y,
        side: slot.side,
        scale,
        score,
        hasTargetOverlap,
        hasChatOverlap,
      };

      if (!bestCandidate || candidate.score > bestCandidate.score) {
        bestCandidate = candidate;
      }
    }

    // If an overlap-free candidate was found at this scale, keep it!
    if (bestCandidate && !bestCandidate.hasTargetOverlap && !bestCandidate.hasChatOverlap) {
      break;
    }
  }

  // Fallback: If target spans entire screen width and overlaps all horizontal gutters,
  // request scroll-to-top so the bottom gap becomes free
  const needsScrollToTop = bestCandidate ? bestCandidate.hasTargetOverlap : false;

  const chosenScale = bestCandidate ? bestCandidate.scale : candidateScales[candidateScales.length - 1];
  const chosenX = bestCandidate ? bestCandidate.x : viewportMargin;
  const groundedY = vpHeight - Math.round(stageHeight * chosenScale) - viewportMargin;
  const chosenY = bestCandidate ? bestCandidate.y : groundedY;
  const chosenSide = bestCandidate ? bestCandidate.side : "left";

  return {
    x: Math.round(chosenX),
    y: Math.round(chosenY),
    side: chosenSide,
    scale: chosenScale,
    useBottomAnchor: true,
    needsScrollToTop,
  };
}
