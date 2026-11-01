export interface AvatarAnchor {
  x: number; // px from left of viewport
  y: number; // px from top of viewport
  side: "left" | "right" | "top" | "bottom";
}

export function calculateAvatarAnchor(
  targetRect: DOMRect,
  stageWidth: number = 320,
  stageHeight: number = 440,
  viewportMargin: number = 16
): AvatarAnchor {
  const vpWidth = window.innerWidth;
  const vpHeight = window.innerHeight;
  const gap = 20;

  // Candidate: Right of target
  const rightX = targetRect.right + gap;
  const rightY = Math.max(viewportMargin, Math.min(targetRect.top, vpHeight - stageHeight - viewportMargin));

  // Candidate: Left of target
  const leftX = targetRect.left - stageWidth - gap;
  const leftY = Math.max(viewportMargin, Math.min(targetRect.top, vpHeight - stageHeight - viewportMargin));

  // Determine which side fits best
  const canFitRight = rightX + stageWidth <= vpWidth - viewportMargin;
  const canFitLeft = leftX >= viewportMargin;

  // Check if target intersects with default bottom-right docked position of widget
  const overlapsBottomRight =
    targetRect.right > vpWidth - stageWidth - viewportMargin &&
    targetRect.bottom > vpHeight - stageHeight - viewportMargin;

  if (overlapsBottomRight && canFitLeft) {
    return {
      x: leftX,
      y: leftY,
      side: "left",
    };
  }

  if (canFitRight && targetRect.left < vpWidth / 2) {
    return {
      x: rightX,
      y: rightY,
      side: "right",
    };
  } else if (canFitLeft) {
    return {
      x: leftX,
      y: leftY,
      side: "left",
    };
  } else if (canFitRight) {
    return {
      x: rightX,
      y: rightY,
      side: "right",
    };
  } else {
    // Narrow viewport / mobile: place on side opposite the target center
    const safeX = targetRect.left > vpWidth / 2 ? viewportMargin : Math.max(viewportMargin, vpWidth - stageWidth - viewportMargin);
    const safeY = Math.max(viewportMargin, vpHeight - stageHeight - viewportMargin);
    return {
      x: safeX,
      y: safeY,
      side: targetRect.left > vpWidth / 2 ? "left" : "right",
    };
  }
}

