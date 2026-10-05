import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Estrenos } from './estrenos';

describe('Estrenos', () => {
  let component: Estrenos;
  let fixture: ComponentFixture<Estrenos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Estrenos],
    }).compileComponents();

    fixture = TestBed.createComponent(Estrenos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
