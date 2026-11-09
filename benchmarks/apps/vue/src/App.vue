<script setup>
import { ref } from 'vue';
import PeopleTable from './PeopleTable.vue';
import AddPersonDialog from './AddPersonDialog.vue';

const adding = ref(false);
</script>

<template>
  <header><strong>Team admin</strong></header>
  <nav aria-label="Main"><a href="/" aria-current="page">People</a></nav>
  <main>
    <h1>People</h1>
    <button @click="adding = true">Add a person</button>
    <PeopleTable />
    <AddPersonDialog :open="adding" @close="adding = false" />
  </main>
</template>
