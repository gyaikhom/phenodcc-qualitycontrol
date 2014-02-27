/*
 * Copyright 2012 Medical Research Council Harwell.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.mousephenotype.dcc.qualitycontrol.entities;

import java.io.Serializable;
import java.math.BigInteger;
import java.util.Date;
import javax.persistence.*;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;
import javax.xml.bind.annotation.XmlType;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Entity
@XmlRootElement
@XmlType(propOrder = {"ai", "oi", "n", "c", "s", "z", "d", "l", "p", "e", "sd", "en", "em", "et"})
public class ProcedureSpecimen implements Serializable {

    private static final long serialVersionUID = 1L;
    @Id
    @Basic(optional = false)
    @NotNull
    private Long aid;
    @Basic(optional = false)
    @NotNull
    private BigInteger poid;
    @Size(max = 45)
    private String name;
    @Basic(optional = false)
    @NotNull
    @Size(min = 1, max = 45)
    private String cohort;
    @Basic(optional = false)
    @NotNull
    private Integer sex;
    @NotNull
    private Integer zygosity;
    @Temporal(TemporalType.TIMESTAMP)
    private Date dob;
    @Size(max = 45)
    private String litter;
    @Size(max = 255)
    private String pipeline;
    @Size(max = 45)
    private String experimenter;
    @Temporal(TemporalType.TIMESTAMP)
    private Date startDate;
    @Size(max = 128)
    private String eqn; // equipment name
    @Size(max = 128)
    private String eqm; // equipment model
    @Size(max = 128)
    private String eqmn; // equipment manufacturer

    public ProcedureSpecimen() {
    }

    public ProcedureSpecimen(Long aid, BigInteger poid, String name, String cohort, Integer sex, Integer zygosity, Date dob, String litter, String pipeline, String experimenter, Date startDate, String eqn, String eqm, String eqmn) {
        this.aid = aid;
        this.poid = poid;
        this.name = name;
        this.cohort = cohort;
        this.sex = sex;
        this.zygosity = zygosity;
        this.dob = dob;
        this.litter = litter;
        this.pipeline = pipeline;
        this.experimenter = experimenter;
        this.startDate = startDate;
        this.eqn = eqn;
        this.eqm = eqm;
        this.eqmn = eqmn;
    }

    @XmlElement(name = "ai")
    public Long getAid() {
        return aid;
    }

    public void setAid(Long aid) {
        this.aid = aid;
    }

    @XmlElement(name = "oi")
    public BigInteger getPoid() {
        return poid;
    }

    public void setPoid(BigInteger poid) {
        this.poid = poid;
    }

    @XmlElement(name = "c")
    public String getCohort() {
        return cohort;
    }

    public void setCohort(String cohort) {
        this.cohort = cohort;
    }

    @XmlElement(name = "d")
    public Date getDob() {
        return dob;
    }

    public void setDob(Date dob) {
        this.dob = dob;
    }

    @XmlElement(name = "em")
    public String getEqm() {
        return eqm;
    }

    public void setEqm(String eqm) {
        this.eqm = eqm;
    }

    @XmlElement(name = "et")
    public String getEqmn() {
        return eqmn;
    }

    public void setEqmn(String eqmn) {
        this.eqmn = eqmn;
    }

    @XmlElement(name = "en")
    public String getEqn() {
        return eqn;
    }

    public void setEqn(String eqn) {
        this.eqn = eqn;
    }

    @XmlElement(name = "e")
    public String getExperimenter() {
        return experimenter;
    }

    public void setExperimenter(String experimenter) {
        this.experimenter = experimenter;
    }

    @XmlElement(name = "l")
    public String getLitter() {
        return litter;
    }

    public void setLitter(String litter) {
        this.litter = litter;
    }

    @XmlElement(name = "n")
    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    @XmlElement(name = "p")
    public String getPipeline() {
        return pipeline;
    }

    public void setPipeline(String pipeline) {
        this.pipeline = pipeline;
    }

    @XmlElement(name = "s")
    public Integer getSex() {
        return sex;
    }

    public void setSex(Integer sex) {
        this.sex = sex;
    }

    @XmlElement(name = "sd")
    public Date getStartDate() {
        return startDate;
    }

    public void setStartDate(Date startDate) {
        this.startDate = startDate;
    }

    @XmlElement(name = "z")
    public Integer getZygosity() {
        return zygosity;
    }

    public void setZygosity(Integer zygosity) {
        this.zygosity = zygosity;
    }
}
