import { Component, viewChild } from '@angular/core';
import { AddPerson } from './add-person';
import { People } from './people';

@Component({
  selector: 'app-root',
  imports: [AddPerson, People],
  templateUrl: './app.html',
})
export class App {
  readonly people = viewChild.required(People);
}
