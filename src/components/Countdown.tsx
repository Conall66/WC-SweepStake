import { useEffect, useState } from 'react';

function remaining(target: number) {
  let delta = Math.max(0, target - Date.now());
  const days = Math.floor(delta / 86_400_000);
  delta -= days * 86_400_000;
  const hours = Math.floor(delta / 3_600_000);
  delta -= hours * 3_600_000;
  const minutes = Math.floor(delta / 60_000);
  delta -= minutes * 60_000;
  const seconds = Math.floor(delta / 1000);
  return { days, hours, minutes, seconds };
}

const pad = (value: number) => String(value).padStart(2, '0');

export function Countdown({ deadline }: { deadline: number }) {
  const [time, setTime] = useState(() => remaining(deadline));

  useEffect(() => {
    const id = window.setInterval(() => setTime(remaining(deadline)), 1000);
    return () => window.clearInterval(id);
  }, [deadline]);

  const cells: Array<[string, number]> = [
    ['days', time.days],
    ['hrs', time.hours],
    ['min', time.minutes],
    ['sec', time.seconds],
  ];

  return (
    <div className="count">
      {cells.map(([label, value]) => (
        <div className="cell" key={label}>
          <div className="n">{pad(value)}</div>
          <div className="l">{label}</div>
        </div>
      ))}
    </div>
  );
}
