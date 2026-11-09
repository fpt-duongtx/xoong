import { useState } from 'react';
import { PeopleTable } from './PeopleTable.jsx';
import { AddPersonDialog } from './AddPersonDialog.jsx';

export function App() {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <header><strong>Team admin</strong></header>
      <nav aria-label="Main"><a href="/" aria-current="page">People</a></nav>
      <main>
        <h1>People</h1>
        <button onClick={() => setAdding(true)}>Add a person</button>
        <PeopleTable />
        <AddPersonDialog open={adding} onClose={() => setAdding(false)} />
      </main>
    </>
  );
}
