package com.version1.recognition.uat;

import io.cucumber.spring.CucumberContextConfiguration;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Wires Cucumber's step definitions into the same Spring context style as
 * the black-box tests: a real app on a random port, isolated MySQL (no demo
 * seed data - each scenario builds its own fixtures), mock AI evaluator.
 * One class, picked up automatically by cucumber-spring - no other file
 * references it directly.
 */
@CucumberContextConfiguration
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("blackbox")
public class CucumberSpringConfiguration {
}
