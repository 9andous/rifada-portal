import { Quote, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { GeometricPattern } from "@/components/brand/geometric-pattern";
import { cn } from "@/lib/cn";

export type WheelSlide = { image: string; alt: string; label: string; text: string | undefined; icon: LucideIcon };

// The wheel is a disc whose centre sits at the screen's edge, so only the slice facing the form
// shows. Each step owns one sector; moving a step turns the wheel by one sector, bringing the next
// photo round to face the form while its quote fades in over the slice. Sector k sits at
// k × sweep degrees clockwise from the facing direction, so turning the wheel by −step × sweep
// brings sector `step` to face it. `--wheel` (set by the page) is the visible width of the slice.
const DIAMETER = 760;

/** Rotating wheel of step photos and quotes, at the end edge of the registration page (xl+). */
export function VisionWheel({ slides, active }: { slides: WheelSlide[]; active: number }) {
  const sweep = 360 / slides.length;
  // Half-chord of a sector at its rim, as a share of the diameter: the photo box's height.
  const box = Math.sin(((sweep / 2) * Math.PI) / 180);
  const tan = Math.tan(((sweep / 2) * Math.PI) / 180);
  const slide = slides[active];

  return (
    <div className="pointer-events-none absolute inset-y-0 end-0 hidden w-[calc(var(--wheel)+3rem)] overflow-clip xl:block">
      {/* Kept clear of the header above and the page band, so the disc is always shown whole. */}
      <div className="sticky top-[100px] h-[min(calc(100dvh-100px),100%)]">
        <div
          className="absolute rounded-full border-[5px] border-band-gold bg-band shadow-2 transition-transform duration-[1100ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
          style={{
            width: DIAMETER,
            height: DIAMETER,
            top: "50%",
            marginTop: -DIAMETER / 2,
            left: `calc(var(--wheel) - ${DIAMETER}px)`,
            transform: `rotate(${-active * sweep}deg)`,
          }}
        >
          <div className="absolute inset-0 overflow-hidden rounded-full">
            {slides.map((s, k) => (
              <div
                key={s.image}
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  transform: `rotate(${k * sweep}deg)`,
                  clipPath: `polygon(50% 50%, 150% ${50 - 100 * tan}%, 150% ${50 + 100 * tan}%)`,
                }}
              >
                <div className="absolute" style={{ left: "50%", width: "50%", top: `${50 - 50 * box}%`, height: `${100 * box}%` }}>
                  <Image src={s.image} alt="" fill sizes="320px" className="object-cover" />
                </div>
                <span aria-hidden="true" className={cn("absolute inset-0 transition-colors duration-700", k === active ? "bg-band/70" : "bg-band/90")} />
                {/* Gold spoke on the sector's leading edge. */}
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 h-1 w-1/2 bg-band-gold"
                  style={{ left: "50%", marginTop: -2, transformOrigin: "0 50%", transform: `rotate(${sweep / 2}deg)` }}
                />
              </div>
            ))}
            {/* Hub: a patterned disc with a gold ring, so the photos read as a band around it. */}
            <div className="band-scope absolute inset-[40%] overflow-hidden rounded-full border-4 border-band-gold bg-band">
              <GeometricPattern size={40} />
            </div>
          </div>
        </div>

        {/* The quote stays upright over the slice in view and changes with the step. */}
        <div
          key={active}
          className="band-scope fade-up absolute top-1/2 flex -translate-y-1/2 flex-col items-center text-center text-band-ink"
          style={{ left: `calc(var(--wheel) - ${DIAMETER / 2}px + ${DIAMETER * 0.1 + 16}px)`, right: "calc(3rem + 24px)" }}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-band-gold text-band [&_svg]:size-5">
            <slide.icon aria-hidden="true" strokeWidth={1.75} />
          </span>
          <p className="mt-2.5 text-xs font-medium text-band-gold">{slide.label}</p>
          {slide.text ? (
            <blockquote className="mt-1.5 text-sm font-semibold leading-[1.85] [text-shadow:0_1px_3px_rgb(0_0_0/0.45)]">
              <Quote aria-hidden="true" className="mx-auto mb-1 size-4 -scale-x-100 text-band-gold" />
              {slide.text}
            </blockquote>
          ) : null}
        </div>

        {/* Fixed marker at the rim, pointing at the sector in view. */}
        <span
          aria-hidden="true"
          className="absolute top-1/2 size-3.5 -translate-y-1/2 rotate-45 bg-band-gold shadow-1"
          style={{ left: "calc(var(--wheel) + 10px)" }}
        />
      </div>
    </div>
  );
}
