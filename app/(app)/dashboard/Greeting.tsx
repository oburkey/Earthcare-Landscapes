'use client'

interface Props {
  name: string
}

export default function Greeting({ name }: Props) {
  const hour = new Date().getHours()
  const timeOfDay =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const firstName = name.split(' ')[0]

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">
        {timeOfDay}, {firstName}
      </h1>
      <p className="mt-0.5 text-sm text-stone-500">
        Here&apos;s what&apos;s on today.
      </p>
    </div>
  )
}
