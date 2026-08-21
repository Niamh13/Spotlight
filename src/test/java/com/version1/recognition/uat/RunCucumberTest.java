package com.version1.recognition.uat;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;

import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;

/**
 * Entry point for the UAT tier - runs every .feature file under
 * src/test/resources/features through the JUnit 5 platform, so `mvn test`
 * picks it up alongside every other test class with no separate command.
 */
@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "com.version1.recognition.uat")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME, value = "pretty, "
        + "html:target/cucumber-report/uat-report.html")
class RunCucumberTest {
}
