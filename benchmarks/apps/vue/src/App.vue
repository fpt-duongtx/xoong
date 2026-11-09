<script setup>
import { ref } from 'vue';
import PeopleTable from './PeopleTable.vue';
import AddPersonDialog from './AddPersonDialog.vue';

const add = ref(null);
</script>

<template>
  <header><strong>Team admin</strong></header>
  <nav aria-label="Main"><a href="/" aria-current="page">People</a></nav>
  <main>
    <h1>People</h1>
    <button @click="add.open()">Add a person</button>
    <PeopleTable />
    <AddPersonDialog ref="add" />
  </main>
</template>
