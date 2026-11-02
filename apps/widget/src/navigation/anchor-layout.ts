export interface AvatarAnchor {
  x: number; // px from left of viewport
  y: number; // px from top of viewport
  side: "left" | "right" | "top" | "bottom";
}

export function calculateAvatarAnchor(
  targetRect: DOMRect,
  stageWidth: number = 290,
  stageHeight: number = 550,
  viewportMargin: number = 16
): AvatarAnchor {
  const vpWidth = window.innerWidth;
  const vpHeight = window.innerHeight;
  const gap = 20;

  // Reserved chat dock zone in bottom-right corner (approx 410px width x 380px height)
  const chatZoneLeft = vpWidth - 410;
  const chatZoneTop = vpHeight - 380;
  const overlapsChat = (x: number, y: number, w: number, h: number) => {
    return x + w > chatZoneLeft && y + h > chatZoneTop;
  };

  // Candidate: Right of target
  const rightX = targetRect.right + gap;
  const rightY = Math.max(viewportMargin, Math.min(targetRect.top, vpHeight - stageHeight - viewportMargin));
  const canFitRight =
    rightX + stageWidth <= vpWidth - viewportMargin &&
    !overlapsChat(rightX, rightY, stageWidth, stageHeight);

  // Candidate: Left of target
  const leftX = targetRect.left - stageWidth - gap;
  const leftY = Math.max(viewportMargin, Math.min(targetRect.top, vpHeight - stageHeight - viewportMargin));
  const canFitLeft =
    leftX >= viewportMargin &&
    !overlapsChat(leftX, leftY, stageWidth, stageHeight);

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
    // If constrained or on mobile, dock safely on opposite side of target center, avoiding chat dock
    const preferLeft = targetRect.left > vpWidth / 2;
    const safeX = preferLeft
      ? viewportMargin
      : Math.max(viewportMargin, Math.min(leftX >= viewportMargin ? leftX : viewportMargin, vpWidth - stageWidth - viewportMargin));
    const safeY = Math.max(viewportMargin, Math.min(targetRect.top, vpHeight - stageHeight - viewportMargin));
    return {
      x: safeX,
      y: safeY,
      side: preferLeft ? "left" : "right",
    };
  }
}

