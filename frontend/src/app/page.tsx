import { redirect } from 'next/navigation';

/** The product is the workspace; the marketing surface is out of scope here. */
export default function HomePage() {
  redirect('/app');
}
